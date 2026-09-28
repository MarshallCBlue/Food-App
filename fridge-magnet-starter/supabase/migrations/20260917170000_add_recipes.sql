-- Step 11 (partial): recipes. A recipe is just a name plus a list of
-- ingredients, each tied to the household's own catalogue item — same
-- pattern as everywhere else in this app, so an ingredient already known
-- to the shopping list or inventory is the same row, not a re-entry of it.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  quantity numeric not null,
  unit text,
  created_at timestamptz not null default now()
);

create index recipes_household_id_idx on public.recipes(household_id);
create index recipe_ingredients_household_id_idx on public.recipe_ingredients(household_id);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);
create index recipe_ingredients_item_id_idx on public.recipe_ingredients(item_id);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy recipes_household_access
  on public.recipes
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

create policy recipe_ingredients_household_access
  on public.recipe_ingredients
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()))
  with check (household_id in (select public.current_household_ids()));

-- Realtime from the start, FULL replica identity from the start — Step 4
-- and Step 7's own history is the reason why: a delete's change payload
-- only carries the primary key by default, and the household_id filter
-- can't match a payload that doesn't have household_id in it.
alter table public.recipes replica identity full;
alter table public.recipe_ingredients replica identity full;
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.recipe_ingredients;

-- Cooking a recipe: consumes each ingredient from whatever inventory
-- exists for it (oldest use-by date first, so cooking naturally works
-- through stock before it goes off), across as many inventory rows as it
-- takes to cover the amount needed. Partial credit — using what's there
-- rather than refusing the whole ingredient just because there isn't a
-- full recipe's worth — matches how cooking actually works: you use what
-- you have and note what's missing, you don't stop dinner over one
-- short ingredient.
--
-- security invoker (the default): every select below already goes
-- through RLS, so a recipe id from another household simply isn't found.
create or replace function public.cook_recipe(target_recipe_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  target_household_id uuid;
  ingredient record;
  inventory_row record;
  remaining_needed numeric;
  consumed_this_row numeric;
  total_consumed numeric;
  consumed_summary jsonb := '[]'::jsonb;
  short_summary jsonb := '[]'::jsonb;
begin
  select household_id into target_household_id from public.recipes where id = target_recipe_id;
  if not found then
    raise exception 'Recipe not found';
  end if;

  for ingredient in
    select ri.item_id, ri.quantity, ri.unit, it.name
    from public.recipe_ingredients ri
    join public.items it on it.id = ri.item_id
    where ri.recipe_id = target_recipe_id
  loop
    remaining_needed := ingredient.quantity;
    total_consumed := 0;

    for inventory_row in
      select id, quantity
      from public.inventory_items
      where household_id = target_household_id and item_id = ingredient.item_id
      order by expires_on asc nulls last, created_at asc
    loop
      exit when remaining_needed <= 0;

      consumed_this_row := least(remaining_needed, inventory_row.quantity);
      perform public.adjust_inventory_quantity(inventory_row.id, -consumed_this_row, 'use');

      remaining_needed := remaining_needed - consumed_this_row;
      total_consumed := total_consumed + consumed_this_row;
    end loop;

    if total_consumed > 0 then
      consumed_summary := consumed_summary || jsonb_build_object(
        'item_id', ingredient.item_id,
        'name', ingredient.name,
        'quantity', total_consumed,
        'unit', ingredient.unit
      );
    end if;

    if remaining_needed > 0 then
      short_summary := short_summary || jsonb_build_object(
        'item_id', ingredient.item_id,
        'name', ingredient.name,
        'quantity', remaining_needed,
        'unit', ingredient.unit
      );
    end if;
  end loop;

  return jsonb_build_object('consumed', consumed_summary, 'short', short_summary);
end;
$$;

revoke all on function public.cook_recipe(uuid) from public, anon;
grant execute on function public.cook_recipe(uuid) to authenticated;
