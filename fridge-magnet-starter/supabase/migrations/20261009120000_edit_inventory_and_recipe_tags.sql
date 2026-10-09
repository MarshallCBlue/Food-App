-- Two additions:
--   1. update_inventory_item: change the amount, unit, place or use-by
--      date of something already in the inventory.
--   2. recipes.tags: a list of your own labels on each recipe.

-- ---------------------------------------------------------------------
-- 1. Editing an inventory item
-- ---------------------------------------------------------------------
--
-- Runs as the person calling it (the normal setting), so the household
-- safety rules on inventory_items still apply: an item from another
-- household is simply "not found".
--
-- If the new place and date match another batch of the same food, the
-- two are joined into one, because the database only allows one batch
-- per food, place and date.
create or replace function public.update_inventory_item(
  target_inventory_item_id uuid,
  new_quantity numeric,
  new_unit text,
  new_location_id uuid,
  new_expires_on date
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  batch record;
  other record;
  clean_unit text := nullif(trim(new_unit), '');
  amount_change numeric;
begin
  -- "for update" holds the row while this runs, so two phones saving at
  -- the same moment take turns instead of overwriting each other.
  select * into batch
  from public.inventory_items
  where id = target_inventory_item_id
  for update;

  if not found then
    raise exception 'That item is no longer in the inventory. It may have just been used up on another phone.';
  end if;

  if new_quantity is null or new_quantity < 0 then
    raise exception 'The amount must be 0 or more.';
  end if;

  if not exists (
    select 1 from public.locations
    where id = new_location_id and household_id = batch.household_id
  ) then
    raise exception 'Pick one of your own places.';
  end if;

  amount_change := new_quantity - batch.quantity;

  -- Setting the amount to 0 means it is all gone.
  if new_quantity = 0 then
    delete from public.inventory_items where id = batch.id;
    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
    values (batch.household_id, batch.item_id, null, -batch.quantity, 'clear', 'set to 0 in the app');
    return jsonb_build_object('status', 'removed');
  end if;

  -- Is there already a batch of this food in the new place with the new date?
  select id, quantity, unit into other
  from public.inventory_items
  where item_id = batch.item_id
    and location_id = new_location_id
    and expires_on is not distinct from new_expires_on
    and id <> batch.id
  for update;

  if found then
    if lower(coalesce(other.unit, '')) <> lower(coalesce(clean_unit, '')) then
      raise exception 'That place already has some of this with the same use-by date, measured in a different unit (%). Make the units match, then try again.',
        coalesce(other.unit, 'no unit');
    end if;

    update public.inventory_items set quantity = quantity + new_quantity where id = other.id;
    delete from public.inventory_items where id = batch.id;

    if amount_change <> 0 then
      insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
      values (batch.household_id, batch.item_id, other.id, amount_change,
              case when amount_change > 0 then 'manual_add' else 'use' end, 'edited in the app');
    end if;

    return jsonb_build_object('status', 'merged', 'inventory_item_id', other.id);
  end if;

  update public.inventory_items
  set quantity = new_quantity,
      unit = clean_unit,
      location_id = new_location_id,
      expires_on = new_expires_on
  where id = batch.id;

  if amount_change <> 0 then
    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
    values (batch.household_id, batch.item_id, batch.id, amount_change,
            case when amount_change > 0 then 'manual_add' else 'use' end, 'edited in the app');
  end if;

  return jsonb_build_object('status', 'updated', 'inventory_item_id', batch.id);
end;
$$;

revoke all on function public.update_inventory_item(uuid, numeric, text, uuid, date) from public, anon;
grant execute on function public.update_inventory_item(uuid, numeric, text, uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Recipe tags
-- ---------------------------------------------------------------------
--
-- A list of short labels stored on the recipe itself, e.g.
-- {Quick, Vegetarian}. Every existing recipe starts with an empty list.
alter table public.recipes add column if not exists tags text[] not null default '{}';
