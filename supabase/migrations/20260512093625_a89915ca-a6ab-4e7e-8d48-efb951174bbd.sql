
ALTER TABLE public.leaders
  ADD COLUMN IF NOT EXISTS last_app_edit_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE public.leader_content
  ADD COLUMN IF NOT EXISTS last_app_edit_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Trigger function: bump last_app_edit_at on UPDATE unless caller explicitly sets it
-- (sync-leaders-import sets last_app_edit_at = OLD.last_app_edit_at to avoid bumping)
CREATE OR REPLACE FUNCTION public.bump_last_app_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only bump if caller didn't explicitly preserve the timestamp
  IF NEW.last_app_edit_at IS NOT DISTINCT FROM OLD.last_app_edit_at THEN
    NEW.last_app_edit_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leaders_bump_app_edit ON public.leaders;
CREATE TRIGGER leaders_bump_app_edit
BEFORE UPDATE ON public.leaders
FOR EACH ROW
EXECUTE FUNCTION public.bump_last_app_edit();

DROP TRIGGER IF EXISTS leader_content_bump_app_edit ON public.leader_content;
CREATE TRIGGER leader_content_bump_app_edit
BEFORE UPDATE ON public.leader_content
FOR EACH ROW
EXECUTE FUNCTION public.bump_last_app_edit();

CREATE INDEX IF NOT EXISTS idx_leaders_dirty ON public.leaders (last_app_edit_at, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_leader_content_dirty ON public.leader_content (last_app_edit_at, last_synced_at);
