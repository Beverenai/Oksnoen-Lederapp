CREATE TABLE public.admin_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'doc',
  title text NOT NULL DEFAULT 'Uten tittel',
  content text NOT NULL DEFAULT '',
  strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notes TO authenticated;
GRANT ALL ON public.admin_notes TO service_role;

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin notes" ON public.admin_notes FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can create admin notes" ON public.admin_notes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update admin notes" ON public.admin_notes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete admin notes" ON public.admin_notes FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER admin_notes_updated_at BEFORE UPDATE ON public.admin_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notes;