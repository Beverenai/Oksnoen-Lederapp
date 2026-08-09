ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;

ALTER TABLE public.mailbox_messages
  ADD COLUMN IF NOT EXISTS reply_seen_at timestamptz;

-- Backfill gender from unambiguous Norwegian first names
UPDATE public.leaders SET gender = 'female'
WHERE gender IS NULL AND lower(split_part(trim(name), ' ', 1)) = ANY (ARRAY[
 'ada','agnes','alice','alma','alva','amalie','amanda','amina','anna','anne','annika','astrid','aurora',
 'bella','benedikte','birgitte','camilla','caroline','cathrine','cecilie','charlotte','clara',
 'ea','eira','eirin','elena','eline','elisabeth','elise','ella','ellen','elsa','emilie','emma','erle','ester','eva',
 'frida','frøya','guro','hanna','hannah','hedda','hedvig','helene','hermine','hilde','ida','iben','inga','ingeborg','inger','ingrid','ingvild','iselin','isabella','isabelle',
 'jenny','johanne','josefine','julia','julie','june','kaja','karen','kari','karin','karina','karoline','katrine','kine','kirsti','kjersti','klara','kornelia','kristine',
 'lara','laura','lea','lena','lene','lilja','lina','line','linda','linnea','lisa','lise','liv','lotte','louise','luna','lydia',
 'madeleine','maiken','maja','malene','malin','maria','marianne','marie','marit','marte','maren','marlene','mia','mille','miriam','mona',
 'nadia','natalie','nina','nora','nicoline','nikoline','olivia','oline','petra','ragnhild','rebekka','rikke','ronja','runa',
 'sanna','sara','sarah','saga','selma','signe','sigrid','silje','sofia','sofie','solveig','stella','stina','stine','sunniva','synne',
 'tea','therese','thea','tilde','tina','tine','tiril','tone','tonje','tora','tove','tuva','tyra',
 'ulrikke','una','vanja','vera','victoria','vilde','ylva','åse']);

UPDATE public.leaders SET gender = 'male'
WHERE gender IS NULL AND lower(split_part(trim(name), ' ', 1)) = ANY (ARRAY[
 'aaron','adam','adrian','aksel','albert','aleksander','alexander','anders','andreas','andré','andre','anton','arne','aron','arthur','arvid','august','axel',
 'benjamin','bendik','birk','bjørn','brage','christer','christian','christoffer','cornelius','daniel','david','didrik','edvard','edvin','eivind','elias','emil','endre','erik','erlend','erling','espen','even',
 'fabian','felix','filip','fredrik','frode','gabriel','geir','gunnar','gustav','halvor','hans','harald','håkon','helge','henrik','herman','hugo','håvard','isak','ivar',
 'jacob','jakob','jens','jesper','joakim','johan','johannes','jonas','jonathan','jon','jonatan','julian','jørgen',
 'kasper','karl','kenneth','kevin','kjell','kjetil','knut','kristian','kristoffer','kyrre','lars','lasse','leander','leif','leo','leon','levi','liam','ludvig','lukas','lucas',
 'magnus','marcus','markus','martin','marius','mats','matias','mathias','mattis','mikael','mikkel','morten','nikolai','nicolai','nils','noah','odin','ola','olav','ole','oliver','oscar','oskar','otto',
 'pål','patrick','peder','per','petter','philip','preben','rasmus','robin','rolf','rune',
 'sander','samuel','sebastian','sigurd','simen','simon','sindre','sivert','sondre','stian','sverre','syver','theo','theodor','tarjei','thomas','tobias','tom','tomas','tor','tord','tore','torstein','trond','trym','truls','trygve',
 'vegard','viktor','vidar','viggo','viljar','vincent','william']);

-- Allow any leader to register a former leader manually (Klineliste only)
CREATE OR REPLACE FUNCTION public.add_external_leader(_name text, _gender text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.current_leader_id();
  _clean text := trim(coalesce(_name, ''));
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Ingen leder'; END IF;
  IF length(_clean) < 3 OR position(' ' in _clean) = 0 THEN
    RAISE EXCEPTION 'Skriv fullt navn';
  END IF;
  IF length(_clean) > 80 THEN RAISE EXCEPTION 'Navnet er for langt'; END IF;
  IF _gender IS NOT NULL AND _gender NOT IN ('male','female') THEN
    RAISE EXCEPTION 'Ugyldig kjønn';
  END IF;

  SELECT id INTO _id FROM public.leaders
   WHERE is_external AND lower(name) = lower(_clean) LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  INSERT INTO public.leaders (name, is_active, is_external, gender)
  VALUES (_clean, false, true, _gender)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_external_leader(text, text) TO authenticated;

-- A hookup with a manually added (external) leader is confirmed immediately,
-- since that person has no account to confirm with.
DROP POLICY IF EXISTS "Leaders can request their own hookups" ON public.leader_hookups;
CREATE POLICY "Leaders can request their own hookups"
ON public.leader_hookups FOR INSERT TO authenticated
WITH CHECK (
  requested_by = public.current_leader_id()
  AND (public.current_leader_id() = leader_a_id OR public.current_leader_id() = leader_b_id)
  AND (
    status = 'pending'
    OR (
      status = 'confirmed'
      AND EXISTS (
        SELECT 1 FROM public.leaders l
        WHERE l.is_external
          AND l.id = CASE WHEN leader_a_id = public.current_leader_id()
                          THEN leader_b_id ELSE leader_a_id END
      )
    )
  )
);

-- Send lock so each hookup event triggers at most one push
CREATE TABLE IF NOT EXISTS public.hookup_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hookup_id uuid NOT NULL REFERENCES public.leader_hookups(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hookup_id, kind)
);

GRANT ALL ON public.hookup_notifications TO service_role;
ALTER TABLE public.hookup_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read hookup notifications"
ON public.hookup_notifications FOR SELECT TO authenticated
USING (public.is_admin());

-- Unread count for the app icon badge
CREATE OR REPLACE FUNCTION public.get_my_unread_badge(_leader_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT COALESCE(_leader_id, public.current_leader_id()) AS id
  )
  SELECT COALESCE((
    SELECT count(*) FROM public.leader_hookups h, me
     WHERE h.status = 'pending' AND h.requested_by <> me.id
       AND (h.leader_a_id = me.id OR h.leader_b_id = me.id)
  ), 0)::int
  + COALESCE((
    SELECT count(*) FROM public.mailbox_messages m, me
     WHERE m.sender_leader_id = me.id
       AND m.admin_reply IS NOT NULL
       AND m.reply_seen_at IS NULL
  ), 0)::int
  + COALESCE((
    SELECT count(*) FROM public.murder_kill_claims c
      JOIN public.murder_games g ON g.id = c.game_id, me
     WHERE c.status = 'pending' AND c.victim_leader_id = me.id
       AND g.period_id = public.get_active_period_id()
  ), 0)::int
$$;

GRANT EXECUTE ON FUNCTION public.get_my_unread_badge(uuid) TO authenticated, service_role;