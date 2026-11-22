-- Live-visningen «Denne økta» på iPhone kan oppdateres fra serveren når appen er lukket.
-- Appen lagrer push-nøkkelen til live-visningen her. Når oppdraget til en leder endres
-- (leader_content) eller aktiv økt endres (app_config), kaller databasen funksjonen
-- push-live-activity, som sender oppdateringen til Apple.

create table if not exists public.live_activity_tokens (
  leader_id uuid primary key references public.leaders(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

alter table public.live_activity_tokens enable row level security;
-- Ingen direkte tilgang fra appen. Skrives bare gjennom funksjonen under.

create or replace function public.set_live_activity_token(_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me uuid := public.current_leader_id();
begin
  if _me is null then
    raise exception 'Ingen leder';
  end if;
  if _token is null or length(trim(_token)) = 0 then
    delete from public.live_activity_tokens where leader_id = _me;
  else
    insert into public.live_activity_tokens (leader_id, token, updated_at)
    values (_me, trim(_token), now())
    on conflict (leader_id) do update set token = excluded.token, updated_at = now();
  end if;
end;
$$;

revoke all on function public.set_live_activity_token(text) from public, anon;
grant execute on function public.set_live_activity_token(text) to authenticated;

-- Kaller push-live-activity. Hemmeligheten ligger i Vault (live_activity_secret).
create or replace function public.notify_live_activity(_leader_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  _secret text;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'live_activity_secret' limit 1;
  if _secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://scarxoedkpjqjahrccvz.supabase.co/functions/v1/push-live-activity',
    body := jsonb_build_object('leader_ids', to_jsonb(_leader_ids)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-live-secret', _secret),
    timeout_milliseconds := 5000
  );
exception when others then
  -- Live-visningen skal aldri stoppe en lagring.
  return;
end;
$$;

revoke all on function public.notify_live_activity(uuid[]) from public, anon, authenticated;

create or replace function public.trg_leader_content_live_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if (new.current_activity is distinct from old.current_activity
      or new.extra_activity is distinct from old.extra_activity
      or new.obs_message is distinct from old.obs_message)
     and exists (select 1 from public.live_activity_tokens t where t.leader_id = new.leader_id) then
    perform public.notify_live_activity(array[new.leader_id]);
  end if;
  return null;
end;
$$;

drop trigger if exists leader_content_live_activity on public.leader_content;
create trigger leader_content_live_activity
  after update on public.leader_content
  for each row execute function public.trg_leader_content_live_activity();

create or replace function public.trg_session_live_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.key like 'session_activities_data%'
     and new.value is distinct from old.value
     and exists (select 1 from public.live_activity_tokens) then
    perform public.notify_live_activity(array(select leader_id from public.live_activity_tokens));
  end if;
  return null;
end;
$$;

drop trigger if exists app_config_session_live_activity on public.app_config;
create trigger app_config_session_live_activity
  after update on public.app_config
  for each row execute function public.trg_session_live_activity();
