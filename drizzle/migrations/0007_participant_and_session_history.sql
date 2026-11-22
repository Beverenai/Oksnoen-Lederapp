-- 1. Ankomst: når og hvem, ikke bare ja/nei ----------------------------------
alter table public.participants
  add column if not exists arrived_at timestamptz,
  add column if not exists arrived_by uuid references public.leaders (id) on delete set null;

create table if not exists public.participant_arrival_log (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  period_id uuid references public.periods (id) on delete set null,
  arrived boolean not null,
  changed_by uuid references public.leaders (id) on delete set null,
  changed_at timestamptz not null default now()
);
GRANT SELECT ON public.participant_arrival_log TO authenticated;
GRANT ALL ON public.participant_arrival_log TO service_role;
create index if not exists participant_arrival_log_period_idx on public.participant_arrival_log (period_id, changed_at desc);
create index if not exists participant_arrival_log_participant_idx on public.participant_arrival_log (participant_id);

-- Hver gang has_arrived endres: sett tidspunkt og hvem, og skriv en linje i loggen.
create or replace function public.log_participant_arrival()
returns trigger language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  if coalesce(new.has_arrived, false) is distinct from coalesce(old.has_arrived, false) then
    select id into who from public.leaders where auth_user_id = auth.uid() limit 1;
    if coalesce(new.has_arrived, false) then
      new.arrived_at := coalesce(new.arrived_at, now());
      new.arrived_by := coalesce(new.arrived_by, who);
    else
      new.arrived_at := null;
      new.arrived_by := null;
    end if;
    insert into public.participant_arrival_log (participant_id, period_id, arrived, changed_by)
    values (new.id, new.period_id, coalesce(new.has_arrived, false), who);
  end if;
  return new;
end $$;
drop trigger if exists participants_arrival_log on public.participants;
create trigger participants_arrival_log before update of has_arrived on public.participants
  for each row execute function public.log_participant_arrival();

-- Mange barn om gangen (en hel hytte, eller de som er valgt).
create or replace function public.set_participants_arrived(_ids uuid[], _arrived boolean)
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  update public.participants set has_arrived = _arrived where id = any(_ids)
    and coalesce(has_arrived, false) is distinct from _arrived;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.set_participants_arrived(uuid[], boolean) to authenticated;

-- 2. Øktene: en logg per dag i stedet for én tekst som skrives over -------------
create table if not exists public.session_log (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references public.periods (id) on delete set null,
  log_date date not null default (now() at time zone 'Europe/Oslo')::date,
  active_session smallint not null check (active_session between 1 and 3),
  sessions jsonb not null,   -- samme form som session_activities_data: {"1":{"reminder","items"},"2":…,"3":…}
  saved_by uuid references public.leaders (id) on delete set null,
  saved_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.session_log TO authenticated;
GRANT ALL ON public.session_log TO service_role;
create index if not exists session_log_period_date_idx on public.session_log (period_id, log_date, saved_at desc);

-- 3. Endringslogg for det viktigste --------------------------------------------
create table if not exists public.change_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text,
  action text not null check (action in ('insert','update','delete')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,             -- auth-brukeren
  changed_at timestamptz not null default now()
);
GRANT SELECT ON public.change_log TO authenticated;
GRANT ALL ON public.change_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.change_log_id_seq TO service_role;
create index if not exists change_log_table_row_idx on public.change_log (table_name, row_id, changed_at desc);
create index if not exists change_log_changed_at_idx on public.change_log (changed_at desc);

create or replace function public.log_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.change_log (table_name, row_id, action, old_data, new_data, changed_by)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'participants', 'participant_activities', 'participant_health_notes', 'participant_health_info',
    'participant_incidents', 'nurse_reports', 'room_swaps', 'cabin_reports', 'kiosk_sales',
    'wristband_assignments', 'period_leaders', 'shift_assignments', 'periods'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_change_log', t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_change()', t || '_change_log', t);
    end if;
  end loop;
end $$;

-- Bare admin og superadmin leser loggene. Appen skriver dem via triggerne og funksjonene over.
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leaders l
    where l.auth_user_id = auth.uid()
      and (public.has_role(l.id, 'admin') or public.has_role(l.id, 'superadmin'))
  );
$$;
grant execute on function public.is_app_admin() to authenticated;

alter table public.participant_arrival_log enable row level security;
alter table public.session_log enable row level security;
alter table public.change_log enable row level security;
create policy "Admin leser ankomstlogg" on public.participant_arrival_log for select to authenticated
  using (public.is_app_admin());
create policy "Admin leser øktlogg" on public.session_log for select to authenticated
  using (public.is_app_admin());
create policy "Admin skriver øktlogg" on public.session_log for insert to authenticated
  with check (public.is_app_admin());
create policy "Admin leser endringslogg" on public.change_log for select to authenticated
  using (public.is_app_admin());