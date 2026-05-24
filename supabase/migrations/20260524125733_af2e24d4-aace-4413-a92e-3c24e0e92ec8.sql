DROP TRIGGER IF EXISTS trg_add_leader_to_walkie ON public.leaders;
DROP FUNCTION IF EXISTS public.add_leader_to_all_walkie_channels() CASCADE;
DROP TABLE IF EXISTS public.walkie_channel_members CASCADE;
DROP TABLE IF EXISTS public.walkie_channels CASCADE;