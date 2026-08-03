CREATE TABLE public.murder_death_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.murder_games(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL UNIQUE REFERENCES public.murder_kill_claims(id) ON DELETE CASCADE,
  victim_leader_id UUID NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.murder_death_notifications TO authenticated;
GRANT ALL ON public.murder_death_notifications TO service_role;

ALTER TABLE public.murder_death_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view murder death notifications"
ON public.murder_death_notifications
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE TRIGGER update_murder_death_notifications_updated_at
BEFORE UPDATE ON public.murder_death_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_murder_death_notifications_game ON public.murder_death_notifications(game_id);