-- Fridge Magnet — Step 2: core schema, security, and household setup.
-- Every table below carries a household_id and is locked with Row Level
-- Security, so the database itself refuses to hand back another
-- household's rows even if the app ever asked for them by mistake.

-- ============================================================
-- Households and membership
-- ============================================================

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  secret_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members(user_id);

-- Returns the households the signed-in person belongs to. security definer
-- means this runs with the function owner's privileges, so it can read
-- household_members without triggering that table's own RLS check on
-- itself (which would otherwise ask the same question forever).
create or replace function public.current_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid();
$$;

-- ============================================================
-- Categories (supermarket aisles) and locations (where things live)
-- ============================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index categories_household_id_idx on public.categories(household_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index locations_household_id_idx on public.locations(household_id);

-- ============================================================
-- Items: the personal product catalogue
-- ============================================================

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  -- Lowercased, trimmed copy of the name, kept in sync automatically, so
  -- "Milk" and "milk" collide on the unique index below instead of
  -- becoming two catalogue entries.
  name_key text generated always as (lower(trim(name))) stored,
  barcode text,
  category_id uuid references public.categories(id) on delete set null,
  default_location_id uuid references public.locations(id) on delete set null,
  default_unit text,
  created_at timestamptz not null default now()
);

create index items_household_id_idx on public.items(household_id);
create index items_category_id_idx on public.items(category_id);
create index items_default_location_id_idx on public.items(default_location_id);
create unique index items_household_name_key_idx on public.items(household_id, name_key);
create unique index items_household_barcode_idx on public.items(household_id, barcode) where barcode is not null;

-- ============================================================
-- Shopping list
-- ============================================================

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  quantity numeric not null default 1,
  unit text,
  note text,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_list_items_household_id_idx on public.shopping_list_items(household_id);
create index shopping_list_items_item_id_idx on public.shopping_list_items(item_id);

-- ============================================================
-- Inventory
-- ============================================================

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  quantity numeric not null default 0,
  unit text,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_household_id_idx on public.inventory_items(household_id);
create index inventory_items_item_id_idx on public.inventory_items(item_id);
create index inventory_items_location_id_idx on public.inventory_items(location_id);

-- Only the handful of items with a use-by date go in this index, rather
-- than every tin in the cupboard.
create index inventory_items_expires_on_idx on public.inventory_items(expires_on) where expires_on is not null;

-- One row per product per location per use-by date. This is what makes
-- "add to inventory" merge amounts instead of creating a duplicate row
-- when you already have some.
create unique index inventory_items_identity_idx
  on public.inventory_items(item_id, location_id, coalesce(expires_on, '0001-01-01'));

-- ============================================================
-- Stock events: the audit log behind undo and future suggestions
-- ============================================================

create table public.stock_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  change_amount numeric not null,
  event_type text not null check (event_type in ('sync_in', 'manual_add', 'use', 'clear', 'undo')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_events_household_id_idx on public.stock_events(household_id);
create index stock_events_item_id_idx on public.stock_events(item_id);
create index stock_events_inventory_item_id_idx on public.stock_events(inventory_item_id);

-- ============================================================
-- Push subscriptions: one row per installed phone
-- ============================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_household_id_idx on public.push_subscriptions(household_id);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

-- ============================================================
-- Sync runs: one row per NFC tap, so a bad tap can be undone in full
-- ============================================================

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  triggered_by uuid references auth.users(id) on delete set null,
  moved_items jsonb not null default '[]'::jsonb,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create index sync_runs_household_id_idx on public.sync_runs(household_id);

-- ============================================================
-- Keep updated_at honest on the two tables people edit repeatedly
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security: same pattern on every table
-- ============================================================

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.sync_runs enable row level security;

-- households and household_members are read-only from the client side.
-- Rows are created and joined through the security-definer functions
-- below instead, so a signed-in stranger can never insert themselves
-- into someone else's household.
create policy households_member_access
  on public.households
  for select
  to authenticated
  using (id in (select public.current_household_ids()));

create policy household_members_self_access
  on public.household_members
  for select
  to authenticated
  using (household_id in (select public.current_household_ids()));

create policy categories_household_access
  on public.categories
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy locations_household_access
  on public.locations
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy items_household_access
  on public.items
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy shopping_list_household_access
  on public.shopping_list_items
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy inventory_household_access
  on public.inventory_items
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy stock_events_household_access
  on public.stock_events
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy push_subscriptions_household_access
  on public.push_subscriptions
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy sync_runs_household_access
  on public.sync_runs
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

-- ============================================================
-- Household creation and joining
--
-- Both run as security definer so they can insert into households and
-- household_members on the caller's behalf, which the policies above
-- otherwise forbid from the client directly.
-- ============================================================

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  new_code text;
  default_categories text[] := array[
    'Fruit & Veg', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Chilled',
    'Frozen', 'Food Cupboard', 'Drinks', 'Household', 'Health & Beauty', 'Other'
  ];
  default_locations text[] := array['Cupboard', 'Drawer', 'Fridge', 'Freezer'];
  category_name text;
  location_name text;
  idx integer;
begin
  -- A six-character code such as "K7QX2P" — easy to read aloud over the
  -- phone when inviting the other person in the household.
  new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.households (name, secret_code)
  values (household_name, new_code)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  idx := 0;
  foreach category_name in array default_categories loop
    insert into public.categories (household_id, name, display_order)
    values (new_household_id, category_name, idx);
    idx := idx + 1;
  end loop;

  idx := 0;
  foreach location_name in array default_locations loop
    insert into public.locations (household_id, name, display_order)
    values (new_household_id, location_name, idx);
    idx := idx + 1;
  end loop;

  return new_household_id;
end;
$$;

create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
begin
  select id into target_household_id
  from public.households
  where secret_code = upper(code);

  if target_household_id is null then
    raise exception 'No household found for that code';
  end if;

  insert into public.household_members (household_id, user_id)
  values (target_household_id, auth.uid())
  on conflict (household_id, user_id) do nothing;

  return target_household_id;
end;
$$;

revoke all on function public.current_household_ids() from public, anon;
grant execute on function public.current_household_ids() to authenticated;

revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

revoke all on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;
