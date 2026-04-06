
-- nurse_reports table
CREATE TABLE public.nurse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.nurse_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nurse_reports_select" ON public.nurse_reports
  FOR SELECT TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "nurse_reports_insert" ON public.nurse_reports
  FOR INSERT TO authenticated WITH CHECK (is_admin() OR is_nurse());
CREATE POLICY "nurse_reports_update" ON public.nurse_reports
  FOR UPDATE TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "nurse_reports_delete" ON public.nurse_reports
  FOR DELETE TO authenticated USING (is_admin() OR is_nurse());

-- nurse_report_mentions table
CREATE TABLE public.nurse_report_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.nurse_reports(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  mention_text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.nurse_report_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentions_select" ON public.nurse_report_mentions
  FOR SELECT TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "mentions_insert" ON public.nurse_report_mentions
  FOR INSERT TO authenticated WITH CHECK (is_admin() OR is_nurse());
CREATE POLICY "mentions_update" ON public.nurse_report_mentions
  FOR UPDATE TO authenticated USING (is_admin() OR is_nurse());
CREATE POLICY "mentions_delete" ON public.nurse_report_mentions
  FOR DELETE TO authenticated USING (is_admin() OR is_nurse());
