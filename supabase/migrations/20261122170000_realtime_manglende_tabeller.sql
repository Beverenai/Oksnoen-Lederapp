-- Appen lytter på endringer i disse tabellene, men de var aldri lagt til i
-- direkteoppdateringen. Tilgangsreglene (RLS) gjelder fortsatt for hvem som får endringene.
do $$
declare
  t text;
begin
  foreach t in array array[
    'gjenglemt_items','home_screen_config','kitchen_item_checks','kitchen_items',
    'kitchen_sections','leader_hookups','leader_matches','murder_games',
    'murder_kill_claims','murder_players','overnatting_responses','participants',
    'periods','pov_photos','rope_controls','team_kitchen_duty'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
