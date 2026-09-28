-- Step 7: moving every checked shopping-list item into the inventory in
-- one tap. Everything happens in a single statement-level transaction —
-- either every item transfers or none do, per the plan's own requirement
-- for this step specifically (unlike Step 5's simpler use-it-up actions,
-- which don't need that guarantee).
--
-- security invoker (the default): RLS on shopping_list_items already
-- scopes the loop to the caller's own household, so no household_id
-- parameter is needed from the client.
create or replace function public.sync_shopping_list_to_inventory(location_overrides jsonb default '{}'::jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  target_household_id uuid;
  moved jsonb := '[]'::jsonb;
  list_row record;
  target_location_id uuid;
  target_inventory_id uuid;
  new_sync_run_id uuid;
begin
  for list_row in
    select sli.id, sli.item_id, sli.quantity, sli.unit, sli.note, sli.household_id,
           it.name, it.default_location_id
    from public.shopping_list_items sli
    join public.items it on it.id = sli.item_id
    where sli.checked = true
  loop
    target_household_id := list_row.household_id;

    target_location_id := coalesce(
      list_row.default_location_id,
      nullif(location_overrides ->> list_row.id::text, '')::uuid
    );

    if target_location_id is null then
      raise exception 'No location chosen for %', list_row.name;
    end if;

    -- Same item, same location, no use-by date (Step 8 territory) —
    -- merge into the existing row rather than duplicate it, checked
    -- fresh each loop iteration so two checked rows for the same item
    -- both land in the one inventory row.
    select id into target_inventory_id
    from public.inventory_items
    where item_id = list_row.item_id
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

    -- First time this item's had a home — remember it for next time.
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

  if target_household_id is null then
    raise exception 'Nothing is checked off to sync';
  end if;

  insert into public.sync_runs (household_id, triggered_by, moved_items)
  values (target_household_id, auth.uid(), moved)
  returning id into new_sync_run_id;

  return new_sync_run_id;
end;
$$;

-- Reverses a sync run: puts each item back on the shopping list, checked,
-- and takes the same amount back out of wherever it was merged into (if
-- that inventory row still exists — it might not, if some of it has
-- already been used since the tap).
create or replace function public.undo_sync_run(target_sync_run_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  run record;
  entry jsonb;
begin
  select * into run from public.sync_runs where id = target_sync_run_id;

  if not found then
    raise exception 'Sync not found';
  end if;

  if run.undone_at is not null then
    raise exception 'That sync has already been undone';
  end if;

  for entry in select * from jsonb_array_elements(run.moved_items)
  loop
    insert into public.shopping_list_items (household_id, item_id, quantity, unit, note, checked)
    values (
      run.household_id,
      (entry ->> 'item_id')::uuid,
      (entry ->> 'quantity')::numeric,
      entry ->> 'unit',
      entry ->> 'note',
      true
    );

    if (entry ->> 'inventory_item_id') is not null
       and exists (select 1 from public.inventory_items where id = (entry ->> 'inventory_item_id')::uuid) then
      perform public.adjust_inventory_quantity(
        (entry ->> 'inventory_item_id')::uuid,
        -(entry ->> 'quantity')::numeric,
        'undo'
      );
    end if;
  end loop;

  update public.sync_runs set undone_at = now() where id = target_sync_run_id;
end;
$$;

revoke all on function public.sync_shopping_list_to_inventory(jsonb) from public, anon;
grant execute on function public.sync_shopping_list_to_inventory(jsonb) to authenticated;

revoke all on function public.undo_sync_run(uuid) from public, anon;
grant execute on function public.undo_sync_run(uuid) to authenticated;
