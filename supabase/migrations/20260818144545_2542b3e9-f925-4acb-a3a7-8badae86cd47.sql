ALTER TABLE public.leirskole_assignments ADD COLUMN IF NOT EXISTS note text;
DROP TABLE IF EXISTS public.leirskole_task_completions;
DROP TABLE IF EXISTS public.leirskole_tasks;
DROP TABLE IF EXISTS public.leirskole_session_info_reads;
DROP TABLE IF EXISTS public.leirskole_session_info;