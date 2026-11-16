-- Lederappen: bildene av barna går automatisk til huben.
--
-- 1. image_changed_at settes hver gang et bilde legges inn eller byttes,
--    uansett hvor det skjer (appen, importen eller miniatyrfunksjonen).
-- 2. Etter en slik endring sender databasen et lite vekkesignal til huben.
--    Signalet har ingen data og ingen nøkkel. Huben henter selv bildene
--    gjennom hub-API-et med sin egen nøkkel.

alter table public.participants add column if not exists image_changed_at timestamptz;

-- Bilder som finnes fra før, får et tidspunkt så huben henter dem første gang.
update public.participants
   set image_changed_at = coalesce(updated_at, created_at, now())
 where image_changed_at is null
   and (image_url is not null or image_thumb_url is not null);

create index if not exists participants_image_changed_idx
  on public.participants (image_changed_at)
  where image_changed_at is not null;

create or replace function public.participant_image_changed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.image_url is not null or new.image_thumb_url is not null then
      new.image_changed_at := now();
    end if;
  elsif new.image_url is distinct from old.image_url
     or new.image_thumb_url is distinct from old.image_thumb_url then
    new.image_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists participant_image_changed on public.participants;
create trigger participant_image_changed
  before insert or update of image_url, image_thumb_url on public.participants
  for each row execute function public.participant_image_changed();

-- Vekkesignal til huben, én gang per lagring (ikke én per barn ved import).
create or replace function public.wake_hub_photo_sync()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://camp-command-compass.lovable.app/api/public/photo-sync',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 2000
  );
  return null;
exception when others then
  -- Huben nede skal aldri stoppe lagringen i appen.
  return null;
end;
$$;

revoke execute on function public.wake_hub_photo_sync() from public, anon, authenticated;

drop trigger if exists wake_hub_photo_sync_upd on public.participants;
create trigger wake_hub_photo_sync_upd
  after update of image_url, image_thumb_url on public.participants
  for each statement execute function public.wake_hub_photo_sync();

drop trigger if exists wake_hub_photo_sync_ins on public.participants;
create trigger wake_hub_photo_sync_ins
  after insert on public.participants
  for each statement execute function public.wake_hub_photo_sync();