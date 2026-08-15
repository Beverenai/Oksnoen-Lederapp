create or replace function public.set_my_drink(_drink text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid := public.current_leader_id();
  _val text := lower(coalesce(_drink, 'beer'));
begin
  if _id is null then
    raise exception 'Ingen leder knyttet til brukeren';
  end if;
  if _val not in ('beer', 'wine', 'drink') then
    _val := 'beer';
  end if;
  update public.leaders set preferred_drink = _val where id = _id;
  return _val;
end;
$$;

create or replace function public.get_my_drink()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select preferred_drink from public.leaders where id = public.current_leader_id()
$$;

grant execute on function public.set_my_drink(text) to authenticated;
grant execute on function public.get_my_drink() to authenticated;