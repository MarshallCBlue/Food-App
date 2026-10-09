-- Three additions:
--   1. unit_scale / convert_amount: turn an amount in one unit into
--      another ("200 g" into "0.2 kg"), or say it can't be done.
--   2. cook_recipe now respects units. It converts where it can, and
--      leaves alone any stock it can't compare (a recipe wanting "200 g"
--      of rice and a cupboard holding "1 bag"), reporting it under
--      "unmatched" instead of quietly emptying the bag.
--   3. put_back_inventory: puts an amount back into the inventory, for
--      the app's Undo button.

-- ---------------------------------------------------------------------
-- 1. Units
-- ---------------------------------------------------------------------

-- Which family a unit belongs to, and how big it is compared with the
-- family's base unit (grams for weight, millilitres for volume).
-- Anything not recognised ("tin", "bag", no unit at all) is its own
-- family of one, so it only ever matches itself ("tins" = "tin").
create or replace function public.unit_scale(unit_text text)
returns table (family text, factor numeric)
language sql
immutable
set search_path = public
as $$
  select
    case
      when u in ('g', 'kg', 'oz', 'lb') then 'weight'
      when u in ('ml', 'cl', 'l', 'tsp', 'tbsp') then 'volume'
      else 'count:' || u
    end,
    case u
      when 'g' then 1
      when 'kg' then 1000
      when 'oz' then 28.3495
      when 'lb' then 453.592
      when 'ml' then 1
      when 'cl' then 10
      when 'l' then 1000
      when 'tsp' then 5
      when 'tbsp' then 15
      else 1
    end
  from (
    select case
      when c in ('g', 'gram', 'grams', 'gr', 'grm') then 'g'
      when c in ('kg', 'kgs', 'kilogram', 'kilograms', 'kilo', 'kilos') then 'kg'
      when c in ('oz', 'ounce', 'ounces') then 'oz'
      when c in ('lb', 'lbs', 'pound', 'pounds') then 'lb'
      when c in ('ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters') then 'ml'
      when c in ('cl', 'centilitre', 'centilitres', 'centiliter', 'centiliters') then 'cl'
      when c in ('l', 'litre', 'litres', 'liter', 'liters', 'ltr') then 'l'
      when c in ('tsp', 'teaspoon', 'teaspoons') then 'tsp'
      when c in ('tbsp', 'tablespoon', 'tablespoons', 'tbs') then 'tbsp'
      when length(c) > 3 and right(c, 1) = 's' then left(c, -1)
      else c
    end as u
    from (select regexp_replace(lower(trim(coalesce(unit_text, ''))), '\.$', '') as c) cleaned
  ) normalised;
$$;

-- An amount converted from one unit to another, or null when the two
-- can't be compared (grams and tins, for example).
create or replace function public.convert_amount(amount numeric, from_unit text, to_unit text)
returns numeric
language sql
immutable
set search_path = public
as $$
  -- trim_scale drops trailing zeros, so 450 is stored as 450, not 450.0000.
  select case when f.family = t.family then trim_scale(round(amount * f.factor / t.factor, 4)) end
  from public.unit_scale(from_unit) f, public.unit_scale(to_unit) t;
$$;

revoke all on function public.unit_scale(text) from public, anon;
grant execute on function public.unit_scale(text) to authenticated, service_role;
revoke all on function public.convert_amount(numeric, text, text) from public, anon;
grant execute on function public.convert_amount(numeric, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Cooking, unit by unit
-- ---------------------------------------------------------------------
--
-- Same as before (soonest use-by date first, partial credit, runs as the
-- caller), with one change: each batch's amount is converted into the
-- recipe's unit before anything is taken. A batch that can't be
-- converted is left untouched. If the recipe still needs more after
-- everything convertible is used, the ingredient goes under "unmatched"
-- when there was stock it couldn't compare (you might have enough, so
-- the person checks), or under "short" when there truly is none.
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
  needed_in_row_unit numeric;
  taken numeric;
  taken_in_recipe_unit numeric;
  total_consumed numeric;
  unmatched_stock jsonb;
  consumed_summary jsonb := '[]'::jsonb;
  short_summary jsonb := '[]'::jsonb;
  unmatched_summary jsonb := '[]'::jsonb;
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
    unmatched_stock := '[]'::jsonb;

    for inventory_row in
      select id, quantity, unit
      from public.inventory_items
      where household_id = target_household_id and item_id = ingredient.item_id
      order by expires_on asc nulls last, created_at asc
    loop
      exit when remaining_needed <= 0;

      needed_in_row_unit := public.convert_amount(remaining_needed, ingredient.unit, inventory_row.unit);

      if needed_in_row_unit is null then
        unmatched_stock := unmatched_stock || jsonb_build_object(
          'quantity', inventory_row.quantity,
          'unit', inventory_row.unit
        );
        continue;
      end if;

      taken := least(needed_in_row_unit, inventory_row.quantity);
      perform public.adjust_inventory_quantity(inventory_row.id, -taken, 'use');

      taken_in_recipe_unit := public.convert_amount(taken, inventory_row.unit, ingredient.unit);
      total_consumed := total_consumed + taken_in_recipe_unit;
      remaining_needed := remaining_needed - taken_in_recipe_unit;

      -- Converting back and forth can leave a crumb like 0.0001 behind.
      if remaining_needed < 0.001 then
        remaining_needed := 0;
      end if;
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
      if jsonb_array_length(unmatched_stock) > 0 then
        unmatched_summary := unmatched_summary || jsonb_build_object(
          'item_id', ingredient.item_id,
          'name', ingredient.name,
          'quantity', remaining_needed,
          'unit', ingredient.unit,
          'stock', unmatched_stock
        );
      else
        short_summary := short_summary || jsonb_build_object(
          'item_id', ingredient.item_id,
          'name', ingredient.name,
          'quantity', remaining_needed,
          'unit', ingredient.unit
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'consumed', consumed_summary,
    'short', short_summary,
    'unmatched', unmatched_summary
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Putting something back (Undo)
-- ---------------------------------------------------------------------
--
-- Adds an amount to the batch of this food in this place with this
-- use-by date, or brings that batch back if it was used up. Logged as
-- an "undo" in the stock history. Runs as the caller, so the household
-- safety rules apply: someone else's food is "not found".
create or replace function public.put_back_inventory(
  target_item_id uuid,
  target_location_id uuid,
  put_quantity numeric,
  put_unit text,
  put_expires_on date
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  food_household_id uuid;
  batch_id uuid;
begin
  if put_quantity is null or put_quantity <= 0 then
    raise exception 'Nothing to put back.';
  end if;

  select household_id into food_household_id from public.items where id = target_item_id;
  if not found then
    raise exception 'That food no longer exists, so it cannot be put back.';
  end if;

  select id into batch_id
  from public.inventory_items
  where item_id = target_item_id
    and location_id = target_location_id
    and expires_on is not distinct from put_expires_on
  for update;

  if found then
    update public.inventory_items set quantity = quantity + put_quantity where id = batch_id;
  else
    insert into public.inventory_items (household_id, item_id, location_id, quantity, unit, expires_on)
    values (food_household_id, target_item_id, target_location_id, put_quantity, nullif(trim(put_unit), ''), put_expires_on)
    returning id into batch_id;
  end if;

  insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
  values (food_household_id, target_item_id, batch_id, put_quantity, 'undo', 'undo in the app');

  return batch_id;
end;
$$;

revoke all on function public.put_back_inventory(uuid, uuid, numeric, text, date) from public, anon;
grant execute on function public.put_back_inventory(uuid, uuid, numeric, text, date) to authenticated;
