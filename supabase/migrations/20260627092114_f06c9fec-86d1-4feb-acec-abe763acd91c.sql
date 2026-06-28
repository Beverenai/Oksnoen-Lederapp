-- Add period_id to participant_activities
ALTER TABLE public.participant_activities ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id);
CREATE INDEX IF NOT EXISTS idx_participant_activities_period ON public.participant_activities(period_id);
DROP TRIGGER IF EXISTS set_period_id_participant_activities ON public.participant_activities;
CREATE TRIGGER set_period_id_participant_activities
  BEFORE INSERT ON public.participant_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

-- Add period_id to rope_controls
ALTER TABLE public.rope_controls ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id);
CREATE INDEX IF NOT EXISTS idx_rope_controls_period ON public.rope_controls(period_id);
UPDATE public.rope_controls SET period_id = '9b567bb1-4195-4d9e-a8a1-36bb68b48545' WHERE period_id IS NULL;
DROP TRIGGER IF EXISTS set_period_id_rope_controls ON public.rope_controls;
CREATE TRIGGER set_period_id_rope_controls
  BEFORE INSERT ON public.rope_controls
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

-- Add period_id to announcements
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id);
CREATE INDEX IF NOT EXISTS idx_announcements_period ON public.announcements(period_id);
UPDATE public.announcements SET period_id = '9b567bb1-4195-4d9e-a8a1-36bb68b48545' WHERE period_id IS NULL;
DROP TRIGGER IF EXISTS set_period_id_announcements ON public.announcements;
CREATE TRIGGER set_period_id_announcements
  BEFORE INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

-- Add period_id to stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id);
CREATE INDEX IF NOT EXISTS idx_stories_period ON public.stories(period_id);
DROP TRIGGER IF EXISTS set_period_id_stories ON public.stories;
CREATE TRIGGER set_period_id_stories
  BEFORE INSERT ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

-- Add period_id to roulette_assignments
ALTER TABLE public.roulette_assignments ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id);
CREATE INDEX IF NOT EXISTS idx_roulette_assignments_period ON public.roulette_assignments(period_id);
DROP TRIGGER IF EXISTS set_period_id_roulette_assignments ON public.roulette_assignments;
CREATE TRIGGER set_period_id_roulette_assignments
  BEFORE INSERT ON public.roulette_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();