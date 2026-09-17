-- Doing "current - amount" in JavaScript and writing back the result reintroduces
-- exactly the binary-floating-point drift numeric columns are meant to avoid —
-- JS numbers are IEEE 754 doubles regardless of what type the value came from.
-- This does the add/subtract inside Postgres, where numeric arithmetic is exact,
-- and logs the stock_events row in the same statement.
--
-- security invoker (the default) means it runs as the caller: the initial
-- select already goes through inventory_items' RLS, so calling this with an
-- id from another household just finds nothing — no household_id parameter
-- needed from the client at all.
create or replace function public.adjust_inventory_quantity(
  target_inventory_item_id uuid,
  delta numeric,
  change_event_type text
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  target_household_id uuid;
  target_item_id uuid;
  current_quantity numeric;
  new_quantity numeric;
  actual_delta numeric;
begin
  select household_id, item_id, quantity
    into target_household_id, target_item_id, current_quantity
  from public.inventory_items
  where id = target_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found';
  end if;

  new_quantity := current_quantity + delta;
  actual_delta := delta;

  if new_quantity <= 0 then
    -- Never log removing more than was actually there, even if the
    -- request asked to take off more than remained.
    actual_delta := -current_quantity;
    delete from public.inventory_items where id = target_inventory_item_id;
    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type)
    values (target_household_id, target_item_id, null, actual_delta, change_event_type);
    return null;
  end if;

  update public.inventory_items set quantity = new_quantity where id = target_inventory_item_id;
  insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type)
  values (target_household_id, target_item_id, target_inventory_item_id, actual_delta, change_event_type);
  return new_quantity;
end;
$$;

revoke all on function public.adjust_inventory_quantity(uuid, numeric, text) from public, anon;
grant execute on function public.adjust_inventory_quantity(uuid, numeric, text) to authenticated;
