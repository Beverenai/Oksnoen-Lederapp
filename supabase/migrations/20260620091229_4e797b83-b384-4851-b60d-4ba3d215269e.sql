CREATE OR REPLACE VIEW public.leader_activities_public AS
SELECT leader_id, current_activity, extra_activity, updated_at
FROM public.leader_content;

ALTER VIEW public.leader_activities_public OWNER TO postgres;
GRANT SELECT ON public.leader_activities_public TO authenticated;