-- Accounts, admins, and making sure one household's data can never leak
-- into another's.
--
-- 1. Admins. A small list of user ids who may see and change every
--    household's data. The only person in "87 Sapley" at the time of
--    writing is made the first admin. Admins pass every RLS policy below,
--    and get a handful of admin_* functions for the jobs RLS can't cover
--    (listing users, deleting accounts, removing members).
--
-- 2. Isolation. RLS already stops you reading another household's rows,
--    but it only checked each row's own household_id. A row could still
--    point at another household's item, location or recipe by id, and
--    anything joined through that pointer (an item's name, say) would be
--    shown to the wrong people. A trigger now insists every pointer stays
--    inside the row's own household, and that a row can't be moved to a
--    different household after the fact.
--
-- 3. Smaller gaps: push subscriptions are now private to the person who
--    made them, joining by code is rate limited so codes can't be guessed
--    by brute force, and the NFC sync only ever touches the one household
--    it was asked to.

-- ---------------------------------------------------------------------
-- 1. Admins
-- ---------------------------------------------------------------------

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

-- No policies: nobody reads or writes this table directly. is_admin()
-- and the admin_* functions below are the only ways in.
alter table public.app_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

insert into public.app_admins (user_id)
select hm.user_id
from public.household_members hm
join public.households h on h.id = hm.household_id
where h.name = '87 Sapley'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- RLS: your own households, or everything if you are an admin
-- ---------------------------------------------------------------------

drop policy households_member_access on public.households;
create policy households_member_access on public.households
  for select to authenticated
  using (id in (select public.current_household_ids()) or (select public.is_admin()));

drop policy household_members_self_access on public.household_members;
create policy household_members_self_access on public.household_members
  for select to authenticated
  using (household_id in (select public.current_household_ids()) or (select public.is_admin()));

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('categories', 'categories_household_access'),
      ('locations', 'locations_household_access'),
      ('items', 'items_household_access'),
      ('shopping_list_items', 'shopping_list_household_access'),
      ('inventory_items', 'inventory_household_access'),
      ('stock_events', 'stock_events_household_access'),
      ('sync_runs', 'sync_runs_household_access'),
      ('recipes', 'recipes_household_access'),
      ('recipe_ingredients', 'recipe_ingredients_household_access')
    ) as v(table_name, policy_name)
  loop
    execute format('drop policy %I on public.%I', t.policy_name, t.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (household_id in (select public.current_household_ids()) or (select public.is_admin()))
         with check (household_id in (select public.current_household_ids()) or (select public.is_admin()))',
      t.policy_name, t.table_name
    );
  end loop;
end;
$$;

-- A phone's notification keys belong to the person who turned reminders
-- on, not to everyone they share a household with.
drop policy push_subscriptions_household_access on public.push_subscriptions;
create policy push_subscriptions_own_access on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id in (select public.current_household_ids()));

-- ---------------------------------------------------------------------
-- 2. Every pointer stays inside its own household
-- ---------------------------------------------------------------------

-- security definer so the check sees the referenced row even when RLS
-- would hide it from the caller — that hidden row is exactly the case
-- being caught.
create or replace function public.enforce_same_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  refs text[];
  ref text;
  ref_table text;
  ref_column text;
  ref_id uuid;
  ref_household uuid;
begin
  if tg_op = 'UPDATE' and new.household_id is distinct from old.household_id then
    raise exception 'A row cannot be moved to a different household';
  end if;

  refs := case tg_table_name
    when 'items' then array['categories:category_id', 'locations:default_location_id']
    when 'shopping_list_items' then array['items:item_id']
    when 'inventory_items' then array['items:item_id', 'locations:location_id']
    when 'stock_events' then array['items:item_id', 'inventory_items:inventory_item_id']
    when 'recipe_ingredients' then array['recipes:recipe_id', 'items:item_id']
    else array[]::text[]
  end;

  foreach ref in array refs loop
    ref_table := split_part(ref, ':', 1);
    ref_column := split_part(ref, ':', 2);
    ref_id := (to_jsonb(new) ->> ref_column)::uuid;
    continue when ref_id is null;

    execute format('select household_id from public.%I where id = $1', ref_table)
      into ref_household
      using ref_id;

    -- Not found is left to the foreign key to report; a different
    -- household is the case only this trigger can catch.
    if ref_household is not null and ref_household <> new.household_id then
      raise exception 'That % belongs to a different household', ref_column;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.enforce_same_household() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'locations', 'items', 'shopping_list_items', 'inventory_items',
    'stock_events', 'sync_runs', 'recipes', 'recipe_ingredients', 'push_subscriptions'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.enforce_same_household()',
      t || '_same_household', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3a. Joining by code: no brute-forcing the six characters
-- ---------------------------------------------------------------------

create table public.household_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index household_join_attempts_user_time_idx
  on public.household_join_attempts (user_id, attempted_at);

alter table public.household_join_attempts enable row level security;

-- A wrong code now returns null instead of raising, because raising would
-- roll back the record of the failed attempt and the limit would never
-- trip. The app treats null as "no household for that code".
create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
  recent_failures integer;
begin
  select count(*) into recent_failures
  from public.household_join_attempts
  where user_id = auth.uid()
    and attempted_at > now() - interval '1 hour';

  if recent_failures >= 10 then
    raise exception 'Too many wrong codes. Try again in an hour.';
  end if;

  select id into target_household_id
  from public.households
  where secret_code = upper(code);

  if target_household_id is null then
    insert into public.household_join_attempts (user_id) values (auth.uid());
    return null;
  end if;

  insert into public.household_members (household_id, user_id)
  values (target_household_id, auth.uid())
  on conflict (household_id, user_id) do nothing;

  return target_household_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3b. The NFC sync moves one household's list, never several
-- ---------------------------------------------------------------------

-- The old version relied on RLS to limit which ticked rows it saw. That
-- is only ever one household for a normal user, but an admin can see
-- every household, and a tap on the fridge must never sweep up someone
-- else's shopping. The household is now explicit. When the app doesn't
-- say which (older installs), it falls back to the caller's own.
drop function public.sync_shopping_list_to_inventory(jsonb);

create function public.sync_shopping_list_to_inventory(
  location_overrides jsonb default '{}'::jsonb,
  target_household_id uuid default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  moved jsonb := '[]'::jsonb;
  list_row record;
  target_location_id uuid;
  target_inventory_id uuid;
  new_sync_run_id uuid;
  moved_any boolean := false;
begin
  if target_household_id is null then
    select household_id into target_household_id
    from public.household_members
    where user_id = auth.uid()
    order by joined_at
    limit 1;
  end if;

  if target_household_id is null then
    raise exception 'No household to sync';
  end if;

  for list_row in
    select sli.id, sli.item_id, sli.quantity, sli.unit, sli.note,
           it.name, it.default_location_id
    from public.shopping_list_items sli
    join public.items it on it.id = sli.item_id
    where sli.checked = true
      and sli.household_id = target_household_id
  loop
    moved_any := true;

    target_location_id := coalesce(
      list_row.default_location_id,
      nullif(location_overrides ->> list_row.id::text, '')::uuid
    );

    if target_location_id is null then
      raise exception 'No location chosen for %', list_row.name;
    end if;

    select id into target_inventory_id
    from public.inventory_items
    where household_id = target_household_id
      and item_id = list_row.item_id
      and location_id = target_location_id
      and expires_on is null;

    if target_inventory_id is not null then
      update public.inventory_items
        set quantity = quantity + list_row.quantity
        where id = target_inventory_id;
    else
      insert into public.inventory_items (household_id, item_id, location_id, quantity, unit)
      values (target_household_id, list_row.item_id, target_location_id, list_row.quantity, list_row.unit)
      returning id into target_inventory_id;
    end if;

    if list_row.default_location_id is null then
      update public.items set default_location_id = target_location_id where id = list_row.item_id;
    end if;

    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type)
    values (target_household_id, list_row.item_id, target_inventory_id, list_row.quantity, 'sync_in');

    moved := moved || jsonb_build_object(
      'item_id', list_row.item_id,
      'name', list_row.name,
      'quantity', list_row.quantity,
      'unit', list_row.unit,
      'note', list_row.note,
      'inventory_item_id', target_inventory_id
    );

    delete from public.shopping_list_items where id = list_row.id;
  end loop;

  if not moved_any then
    raise exception 'Nothing is checked off to sync';
  end if;

  insert into public.sync_runs (household_id, triggered_by, moved_items)
  values (target_household_id, auth.uid(), moved)
  returning id into new_sync_run_id;

  return new_sync_run_id;
end;
$$;

revoke all on function public.sync_shopping_list_to_inventory(jsonb, uuid) from public, anon;
grant execute on function public.sync_shopping_list_to_inventory(jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Admin-only functions
-- ---------------------------------------------------------------------

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do that';
  end if;
end;
$$;

revoke all on function public.require_admin() from public, anon, authenticated;

-- Every household, who is in it, and roughly how much it holds.
create or replace function public.admin_list_households()
returns table (
  id uuid,
  name text,
  secret_code text,
  created_at timestamptz,
  members jsonb,
  shopping_list_count bigint,
  inventory_count bigint,
  recipe_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    h.id,
    h.name,
    h.secret_code,
    h.created_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('user_id', u.id, 'email', u.email) order by hm.joined_at)
       from public.household_members hm
       join auth.users u on u.id = hm.user_id
       where hm.household_id = h.id),
      '[]'::jsonb
    ),
    (select count(*) from public.shopping_list_items s where s.household_id = h.id),
    (select count(*) from public.inventory_items i where i.household_id = h.id),
    (select count(*) from public.recipes r where r.household_id = h.id)
  from public.households h
  order by h.created_at;
end;
$$;

-- Every account, including ones that never set up a household.
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean,
  households jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    exists (select 1 from public.app_admins a where a.user_id = u.id),
    coalesce(
      (select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name))
       from public.household_members hm
       join public.households h on h.id = hm.household_id
       where hm.user_id = u.id),
      '[]'::jsonb
    )
  from auth.users u
  order by u.created_at;
end;
$$;

create or replace function public.admin_remove_member(target_household_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  delete from public.household_members
  where household_id = target_household_id and user_id = target_user_id;

  delete from public.push_subscriptions
  where household_id = target_household_id and user_id = target_user_id;
end;
$$;

-- Deletes a household and everything in it. Children are removed in an
-- explicit order because inventory rows refuse to let their location be
-- deleted out from under them.
create or replace function public.admin_delete_household(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  delete from public.stock_events where household_id = target_household_id;
  delete from public.sync_runs where household_id = target_household_id;
  delete from public.recipe_ingredients where household_id = target_household_id;
  delete from public.recipes where household_id = target_household_id;
  delete from public.shopping_list_items where household_id = target_household_id;
  delete from public.inventory_items where household_id = target_household_id;
  delete from public.items where household_id = target_household_id;
  delete from public.locations where household_id = target_household_id;
  delete from public.categories where household_id = target_household_id;
  delete from public.push_subscriptions where household_id = target_household_id;
  delete from public.household_members where household_id = target_household_id;
  delete from public.households where id = target_household_id;
end;
$$;

-- Deletes someone's account. Any household they were the only member of
-- goes with it, since nobody else could ever reach that data again.
-- Shared households stay, minus this person.
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  solo_household_id uuid;
begin
  perform public.require_admin();

  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own account from here';
  end if;

  for solo_household_id in
    select hm.household_id
    from public.household_members hm
    where hm.user_id = target_user_id
      and not exists (
        select 1 from public.household_members other
        where other.household_id = hm.household_id and other.user_id <> target_user_id
      )
  loop
    perform public.admin_delete_household(solo_household_id);
  end loop;

  delete from auth.users where id = target_user_id;
end;
$$;

create or replace function public.admin_set_admin(target_user_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if make_admin then
    insert into public.app_admins (user_id) values (target_user_id)
    on conflict (user_id) do nothing;
  else
    if target_user_id = auth.uid() then
      raise exception 'You cannot remove your own admin rights';
    end if;
    delete from public.app_admins where user_id = target_user_id;
  end if;
end;
$$;

revoke all on function public.admin_list_households() from public, anon;
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_remove_member(uuid, uuid) from public, anon;
revoke all on function public.admin_delete_household(uuid) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_list_households() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_remove_member(uuid, uuid) to authenticated;
grant execute on function public.admin_delete_household(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
