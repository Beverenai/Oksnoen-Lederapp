
-- ============ shift_types ============
CREATE TABLE public.shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  day_type text NOT NULL CHECK (day_type IN ('normal', 'arrival', 'departure')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_hours numeric(3,2) NOT NULL,
  sort_order integer NOT NULL,
  min_leaders integer DEFAULT 0,
  requires_18_plus boolean DEFAULT false,
  all_must_attend boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(slug, day_type)
);

ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_types_select ON public.shift_types FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY shift_types_insert ON public.shift_types FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY shift_types_update ON public.shift_types FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY shift_types_delete ON public.shift_types FOR DELETE TO authenticated USING (is_admin());

-- ============ leader_teams ============
CREATE TABLE public.leader_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  period_number integer NOT NULL,
  year integer NOT NULL DEFAULT 2026,
  team text NOT NULL CHECK (team IN ('team1', 'team2', 'team1f', 'team2f')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(leader_id, period_number, year)
);

CREATE INDEX idx_leader_teams_period ON public.leader_teams(period_number, year);

ALTER TABLE public.leader_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY leader_teams_select ON public.leader_teams FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY leader_teams_insert ON public.leader_teams FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY leader_teams_update ON public.leader_teams FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY leader_teams_delete ON public.leader_teams FOR DELETE TO authenticated USING (is_admin());

-- ============ shift_schedules ============
CREATE TABLE public.shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_number integer NOT NULL,
  year integer NOT NULL DEFAULT 2026,
  period_length integer NOT NULL DEFAULT 7 CHECK (period_length IN (7, 8)),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES public.leaders(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(period_number, year)
);

ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_schedules_select ON public.shift_schedules FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY shift_schedules_insert ON public.shift_schedules FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY shift_schedules_update ON public.shift_schedules FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY shift_schedules_delete ON public.shift_schedules FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_shift_schedules_updated
BEFORE UPDATE ON public.shift_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ shift_assignments ============
CREATE TABLE public.shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.shift_schedules(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  day_type text NOT NULL CHECK (day_type IN ('arrival', 'normal', 'departure')),
  shift_type_id uuid NOT NULL REFERENCES public.shift_types(id),
  assignment_type text NOT NULL CHECK (assignment_type IN ('team', 'leader')),
  team_name text CHECK (team_name IN ('team1', 'team2', 'team1f', 'team2f', 'all')),
  leader_id uuid REFERENCES public.leaders(id) ON DELETE SET NULL,
  role text DEFAULT 'standard',
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_shift_assignments_schedule ON public.shift_assignments(schedule_id);
CREATE INDEX idx_shift_assignments_day ON public.shift_assignments(schedule_id, day_index);
CREATE INDEX idx_shift_assignments_leader ON public.shift_assignments(leader_id);

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_assignments_select ON public.shift_assignments FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY shift_assignments_insert ON public.shift_assignments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY shift_assignments_update ON public.shift_assignments FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY shift_assignments_delete ON public.shift_assignments FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_shift_assignments_updated
BEFORE UPDATE ON public.shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ special_duties ============
CREATE TABLE public.special_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.shift_schedules(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  duty_type text NOT NULL CHECK (duty_type IN ('morgenvakt', 'bingsvakt', 'nattevakt', 'frokostvakt', 'kjokkenvakt', 'sanitas', 'seilern_box')),
  leader_id uuid NOT NULL REFERENCES public.leaders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(schedule_id, day_index, duty_type, leader_id)
);

CREATE INDEX idx_special_duties_schedule ON public.special_duties(schedule_id, day_index);

ALTER TABLE public.special_duties ENABLE ROW LEVEL SECURITY;

CREATE POLICY special_duties_select ON public.special_duties FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY special_duties_insert ON public.special_duties FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY special_duties_update ON public.special_duties FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY special_duties_delete ON public.special_duties FOR DELETE TO authenticated USING (is_admin());

-- ============ SEED: shift_types ============
-- NORMAL day (16)
INSERT INTO public.shift_types (name, slug, day_type, start_time, end_time, duration_hours, sort_order, min_leaders, requires_18_plus, all_must_attend) VALUES
  ('Morgenvakt',          'morgenvakt',         'normal', '06:00', '08:30', 2.5,  1, 1, false, false),
  ('Vekking',             'vekking',            'normal', '08:30', '09:00', 0.5,  2, 2, false, false),
  ('Frokost',             'frokost',            'normal', '09:00', '10:00', 1.0,  3, 5, false, false),
  ('Bings morgen',        'bings_morgen',       'normal', '09:30', '11:00', 1.5,  4, 2, false, false),
  ('Personalmøte 1',      'personalmoete',      'normal', '10:45', '11:00', 0.25, 5, 0, false, false),
  ('Økt 1',               'okt1',               'normal', '11:00', '14:00', 3.0,  6, 15, false, false),
  ('Middag',              'middag',             'normal', '14:00', '15:30', 1.5,  7, 6, false, false),
  ('Bings ettermiddag',   'bings_ettermiddag',  'normal', '15:30', '16:00', 0.5,  8, 2, false, false),
  ('Personalmøte 2',      'personalmoete2',     'normal', '15:45', '16:00', 0.25, 9, 0, false, true),
  ('Økt 2',               'okt2',               'normal', '16:00', '19:00', 3.0, 10, 15, false, false),
  ('Kveldsmat',           'kveldsmat',          'normal', '19:00', '20:00', 1.0, 11, 5, false, false),
  ('Bings kveld',         'bings_kveld',        'normal', '20:00', '20:30', 0.5, 12, 2, false, false),
  ('Økt 3',               'okt3',               'normal', '20:30', '00:00', 3.5, 13, 8, true,  false),
  ('Legging',             'legging',            'normal', '22:00', '01:00', 3.0, 14, 8, true,  false),
  ('Nattevakt',           'nattevakt',          'normal', '23:30', '05:00', 5.5, 15, 2, true,  false),
  ('Kjøkkenvakt',         'kjokkenvakt',        'normal', '09:00', '17:00', 8.0, 16, 1, false, false);

-- ARRIVAL day (9)
INSERT INTO public.shift_types (name, slug, day_type, start_time, end_time, duration_hours, sort_order, min_leaders, requires_18_plus, all_must_attend) VALUES
  ('Forberedelser',       'forberedelser',         'arrival', '12:00', '14:00', 2.0,  1, 4,  false, false),
  ('Lunsj/møte',          'lunsj_mote',            'arrival', '14:00', '15:00', 1.0,  2, 0,  false, true),
  ('Ankomst',             'ankomst',               'arrival', '15:00', '18:30', 3.5,  3, 15, false, false),
  ('Middag',              'middag_ankomst',        'arrival', '18:30', '19:30', 1.0,  4, 6,  false, false),
  ('Informasjon',         'informasjon',           'arrival', '19:30', '20:15', 0.75, 5, 4,  false, false),
  ('Intro/møter',         'intro_moter',           'arrival', '20:15', '21:00', 0.75, 6, 10, false, false),
  ('Kiosk',               'kiosk',                 'arrival', '21:00', '22:30', 1.5,  7, 4,  true,  false),
  ('Legging',             'legging_ankomst',       'arrival', '22:30', '01:00', 2.5,  8, 6,  true,  false),
  ('Nattevakt',           'nattevakt_ankomst',     'arrival', '00:00', '03:00', 3.0,  9, 2,  true,  false);

-- DEPARTURE day (8)
INSERT INTO public.shift_types (name, slug, day_type, start_time, end_time, duration_hours, sort_order, min_leaders, requires_18_plus, all_must_attend) VALUES
  ('Vekking',             'vekking_avreise',       'departure', '08:30', '09:00', 0.5, 1, 2,  false, false),
  ('Rydding',             'rydding',               'departure', '09:00', '10:00', 1.0, 2, 10, false, false),
  ('Frokost',             'frokost_avreise',       'departure', '10:00', '11:00', 1.0, 3, 5,  false, false),
  ('Utdeling pass',       'utdeling_pass',         'departure', '11:00', '12:00', 1.0, 4, 4,  false, false),
  ('Avreise',             'avreise',               'departure', '12:00', '14:00', 1.0, 5, 6,  false, false),
  ('Lunsj/møte',          'lunsj_mote_avreise',    'departure', '14:00', '15:00', 2.0, 6, 0,  false, true),
  ('Opprydning 1',        'opprydning1',           'departure', '15:00', '16:30', 1.5, 7, 10, false, false),
  ('Opprydning 2',        'opprydning2',           'departure', '16:30', '18:00', 2.5, 8, 10, false, false);
