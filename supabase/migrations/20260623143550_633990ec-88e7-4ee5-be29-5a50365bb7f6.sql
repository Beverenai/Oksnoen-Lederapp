-- Dynga: admin-only kanban for participant behavior
CREATE TABLE public.dynga_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  color text NOT NULL DEFAULT 'muted',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dynga_columns TO authenticated;
GRANT ALL ON public.dynga_columns TO service_role;
ALTER TABLE public.dynga_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY dynga_columns_select ON public.dynga_columns FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY dynga_columns_insert ON public.dynga_columns FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY dynga_columns_update ON public.dynga_columns FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY dynga_columns_delete ON public.dynga_columns FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.dynga_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL UNIQUE REFERENCES public.participants(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.dynga_columns(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dynga_cards TO authenticated;
GRANT ALL ON public.dynga_cards TO service_role;
ALTER TABLE public.dynga_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY dynga_cards_select ON public.dynga_cards FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY dynga_cards_insert ON public.dynga_cards FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY dynga_cards_update ON public.dynga_cards FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY dynga_cards_delete ON public.dynga_cards FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER dynga_cards_updated_at BEFORE UPDATE ON public.dynga_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dynga_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.dynga_cards(id) ON DELETE CASCADE,
  leader_id uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dynga_comments TO authenticated;
GRANT ALL ON public.dynga_comments TO service_role;
ALTER TABLE public.dynga_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dynga_comments_select ON public.dynga_comments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY dynga_comments_insert ON public.dynga_comments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY dynga_comments_update ON public.dynga_comments FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY dynga_comments_delete ON public.dynga_comments FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX dynga_cards_column_idx ON public.dynga_cards(column_id, sort_order);
CREATE INDEX dynga_comments_card_idx ON public.dynga_comments(card_id, created_at DESC);

-- Seed default columns
INSERT INTO public.dynga_columns (title, color, sort_order) VALUES
  ('Observasjon', 'muted', 0),
  ('Positivt', 'green', 1),
  ('Advarsel', 'amber', 2),
  ('Oppfølging', 'blue', 3);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynga_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynga_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynga_comments;