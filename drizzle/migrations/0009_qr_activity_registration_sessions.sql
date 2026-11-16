-- 1. Hver aktivitet får periode og leder, også når den legges inn for hånd.
create or replace function public.fill_participant_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.period_id is null then
    select period_id into new.period_id from public.participants where id = new.participant_id;
  end if;
  if new.registered_by is null then
    new.registered_by := public.current_leader_id();
  end if;
  if new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists participant_activities_fill on public.participant_activities;
create trigger participant_activities_fill before insert on public.participant_activities
  for each row execute function public.fill_participant_activity();

create index if not exists idx_participant_activities_participant_time
  on public.participant_activities (participant_id, completed_at desc);

-- 2. En registrering = én gang lederen velger en aktivitet og skanner en gruppe.
--    Samme barn kan bare legges inn én gang per registrering.
alter table public.participant_activities add column if not exists scan_session_id uuid;
create unique index if not exists participant_activities_one_per_session
  on public.participant_activities (scan_session_id, participant_id, lower(activity))
  where scan_session_id is not null;

-- 3. Skanning: hver gang lagres. Tube i økt 1 og igjen i økt 2 er to rader.
--    Bare samme barn skannet to ganger i samme registrering (scan_session_id) avvises.
create or replace function public.record_wristband_scans(_scans jsonb)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  _me uuid := public.current_leader_id();
  _it jsonb;
  _id uuid;
  _c text;
  _act text;
  _at timestamptz;
  _sess uuid;
  _asg public.wristband_assignments%rowtype;
  _before integer;
  _out jsonb := '[]'::jsonb;
begin
  if _me is null then raise exception 'Ingen leder'; end if;
  if _scans is null or jsonb_typeof(_scans) <> 'array' then return _out; end if;
  if jsonb_array_length(_scans) > 200 then raise exception 'For mange skanninger i én sending'; end if;

  for _it in select * from jsonb_array_elements(_scans) loop
    begin
      _id := (_it->>'client_scan_id')::uuid;
      _c := public.normalize_wristband_code(_it->>'code');
      _act := btrim(coalesce(_it->>'activity', ''));
      _at := least(coalesce((_it->>'scanned_at')::timestamptz, now()), now());
      _sess := nullif(_it->>'session_id', '')::uuid;
    exception when others then
      _out := _out || jsonb_build_object('client_scan_id', _it->>'client_scan_id', 'status', 'ugyldig');
      continue;
    end;

    if _id is null or _c is null or _act = '' or length(_act) > 80 then
      _out := _out || jsonb_build_object('client_scan_id', _id, 'status', 'ugyldig');
      continue;
    end if;

    if exists (select 1 from public.participant_activities where client_scan_id = _id) then
      _out := _out || jsonb_build_object('client_scan_id', _id, 'status', 'fantes');
      continue;
    end if;

    -- Hvem hadde båndet da det ble skannet? (skanningen kan komme inn senere)
    select * into _asg from public.wristband_assignments
      where code = _c
        and assigned_at <= _at + interval '2 minutes'
        and (released_at is null or released_at > _at)
      order by assigned_at desc
      limit 1;
    if not found then
      select * into _asg from public.wristband_assignments
        where code = _c and released_at is null and assigned_at <= _at + interval '24 hours'
        limit 1;
    end if;
    if not found then
      _out := _out || jsonb_build_object('client_scan_id', _id, 'status', 'ukjent_band');
      continue;
    end if;

    -- Samme barn skannet to ganger i samme registrering: ikke lagre igjen.
    if _sess is not null and exists (
      select 1 from public.participant_activities
      where scan_session_id = _sess and participant_id = _asg.participant_id
        and lower(activity) = lower(_act)
    ) then
      _out := _out || jsonb_build_object('client_scan_id', _id, 'status', 'dobbel', 'participant_id', _asg.participant_id);
      continue;
    end if;

    select count(*) into _before from public.participant_activities
      where participant_id = _asg.participant_id and lower(activity) = lower(_act);

    insert into public.participant_activities
      (participant_id, activity, registered_by, completed_at, period_id, source, wristband_code, scanned_at, client_scan_id, scan_session_id)
    values
      (_asg.participant_id, _act, _me, _at, _asg.period_id, 'qr', _c, _at, _id, _sess);

    _out := _out || jsonb_build_object(
      'client_scan_id', _id,
      'status', case when _before > 0 then 'gjentatt' else 'registrert' end,
      'gang', _before + 1,
      'participant_id', _asg.participant_id);
  end loop;
  return _out;
end;
$function$;
