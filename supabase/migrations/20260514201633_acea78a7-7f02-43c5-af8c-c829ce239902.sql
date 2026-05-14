ALTER TABLE public.shift_assignments
  ADD COLUMN IF NOT EXISTS excluded_leader_ids uuid[] NOT NULL DEFAULT '{}';