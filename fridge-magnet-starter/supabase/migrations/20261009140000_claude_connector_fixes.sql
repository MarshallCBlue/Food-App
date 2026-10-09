-- Claude connector: two small fixes found while testing it.
--
-- 1. Topping up stock in a unit that means the same thing ("grams" onto
--    "500 g") kept the right amount but relabelled the batch "750 grams".
--    The batch now keeps its own label; the label only changes when you
--    chose to switch units (when_unit_differs).
--
-- 2. Supabase gives every new table a default grant to the public roles.
--    Row Level Security (with no policies) already hid every row of
--    assistant_keys, but the grant itself is now removed as well, so the
--    table is server-only twice over.

revoke all on table public.assistant_keys from anon, authenticated;

create or replace function public.assistant_add_to_stock(
  target_household_id uuid,
  target_item_id uuid,
  target_location_id uuid,
  add_quantity numeric,
  add_unit text,
  use_by date,
  when_unit_differs text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  food record;
  place record;
  batch record;
  new_unit text := nullif(trim(add_unit), '');
  same_unit boolean;
  result_id uuid;
  result_quantity numeric;
  result_unit text;
  delta numeric;
begin
  select id, name, default_location_id into food
  from public.items
  where id = target_item_id and household_id = target_household_id;
  if not found then
    raise exception 'That food is not saved in this household';
  end if;

  select id, name into place
  from public.locations
  where id = target_location_id and household_id = target_household_id;
  if not found then
    raise exception 'That storage place is not in this household';
  end if;

  if add_quantity is null or add_quantity <= 0 then
    raise exception 'The amount must be more than zero';
  end if;

  select id, quantity, unit into batch
  from public.inventory_items
  where household_id = target_household_id
    and item_id = target_item_id
    and location_id = target_location_id
    and expires_on is not distinct from use_by
  for update;

  if not found then
    insert into public.inventory_items (household_id, item_id, location_id, quantity, unit, expires_on)
    values (target_household_id, target_item_id, target_location_id, add_quantity, new_unit, use_by)
    returning id into result_id;

    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
    values (target_household_id, target_item_id, result_id, add_quantity, 'manual_add', 'via Claude');

    -- First time this food has had a home: remember it, as the NFC tap does.
    if food.default_location_id is null then
      update public.items set default_location_id = target_location_id where id = target_item_id;
    end if;

    return jsonb_build_object(
      'status', 'added', 'stock_id', result_id, 'name', food.name, 'place', place.name,
      'now_in_stock', public.assistant_format_amount(add_quantity, new_unit),
      'use_by', use_by
    );
  end if;

  same_unit := public.assistant_normalise_unit(batch.unit) = public.assistant_normalise_unit(new_unit);

  if not same_unit then
    if when_unit_differs is null then
      return jsonb_build_object(
        'status', 'needs_clarification',
        'name', food.name,
        'question', format(
          'There is already %s of %s in the %s%s. Should I count the %s on top (making %s), or set it to an amount you give me?',
          public.assistant_format_amount(batch.quantity, batch.unit),
          food.name,
          place.name,
          case when use_by is null then '' else ' with the same use-by date' end,
          public.assistant_format_amount(add_quantity, new_unit),
          public.assistant_format_amount(batch.quantity + add_quantity, new_unit)
        ),
        'answer_with', 'Call add_to_stock again for this food with when_unit_differs set to add_anyway, or to replace with the total they give you as the quantity.'
      );
    elsif when_unit_differs not in ('add_anyway', 'replace') then
      raise exception 'when_unit_differs must be add_anyway or replace';
    end if;
  end if;

  if when_unit_differs = 'replace' then
    result_quantity := add_quantity;
  else
    result_quantity := batch.quantity + add_quantity;
  end if;
  delta := result_quantity - batch.quantity;

  -- Same unit: keep the batch's own label ("g" stays "g").
  -- Switched unit: the new label, as chosen.
  result_unit := case when same_unit then coalesce(batch.unit, new_unit) else coalesce(new_unit, batch.unit) end;

  update public.inventory_items
  set quantity = result_quantity,
      unit = result_unit
  where id = batch.id;

  if delta <> 0 then
    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
    values (target_household_id, target_item_id, batch.id, delta,
            case when delta > 0 then 'manual_add' else 'use' end, 'via Claude');
  end if;

  return jsonb_build_object(
    'status', case when when_unit_differs = 'replace' then 'replaced' else 'topped_up' end,
    'stock_id', batch.id, 'name', food.name, 'place', place.name,
    'was', public.assistant_format_amount(batch.quantity, batch.unit),
    'now_in_stock', public.assistant_format_amount(result_quantity, result_unit),
    'use_by', use_by
  );
end;
$$;

revoke all on function public.assistant_add_to_stock(uuid, uuid, uuid, numeric, text, date, text) from public, anon, authenticated;
grant execute on function public.assistant_add_to_stock(uuid, uuid, uuid, numeric, text, date, text) to service_role;
