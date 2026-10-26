-- Putting the shopping away can now leave some ticked items out of the
-- inventory: things that were bought but don't need tracking (a birthday
-- card, a takeaway pizza). Those are still bought, so they come off the
-- shopping list, but no stock is added for them.
--
-- They are recorded on the sync run as skipped_items, so "Undo this" puts
-- them back on the list (ticked) along with everything that did move in.

alter table public.sync_runs
  add column if not exists skipped_items jsonb not null default '[]'::jsonb;

-- The old two-setting version is replaced by one with a third setting,
-- skip_ids. It has a default, so the Claude connector, which only sends
-- the first two, carries on working unchanged.
drop function public.sync_shopping_list_to_inventory(jsonb, uuid);

create function public.sync_shopping_list_to_inventory(
  location_overrides jsonb default '{}'::jsonb,
  target_household_id uuid default null,
  skip_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  moved jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
  list_row record;
  target_location_id uuid;
  target_inventory_id uuid;
  new_sync_run_id uuid;
  found_any boolean := false;
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
    found_any := true;

    -- Left out on purpose: off the list, but not into stock.
    if list_row.id = any(coalesce(skip_ids, '{}'::uuid[])) then
      skipped := skipped || jsonb_build_object(
        'item_id', list_row.item_id,
        'name', list_row.name,
        'quantity', list_row.quantity,
        'unit', list_row.unit,
        'note', list_row.note
      );
      delete from public.shopping_list_items where id = list_row.id;
      continue;
    end if;

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

  if not found_any then
    raise exception 'Nothing is checked off to sync';
  end if;

  insert into public.sync_runs (household_id, triggered_by, moved_items, skipped_items)
  values (target_household_id, auth.uid(), moved, skipped)
  returning id into new_sync_run_id;

  return new_sync_run_id;
end;
$$;

revoke all on function public.sync_shopping_list_to_inventory(jsonb, uuid, uuid[]) from public, anon;
grant execute on function public.sync_shopping_list_to_inventory(jsonb, uuid, uuid[]) to authenticated;

-- Undo now also puts the skipped items back on the list, ticked, exactly
-- as they were before the shopping was put away.
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

  for entry in select * from jsonb_array_elements(coalesce(run.skipped_items, '[]'::jsonb))
  loop
    if exists (select 1 from public.items where id = (entry ->> 'item_id')::uuid) then
      insert into public.shopping_list_items (household_id, item_id, quantity, unit, note, checked)
      values (
        run.household_id,
        (entry ->> 'item_id')::uuid,
        (entry ->> 'quantity')::numeric,
        entry ->> 'unit',
        entry ->> 'note',
        true
      );
    end if;
  end loop;

  update public.sync_runs set undone_at = now() where id = target_sync_run_id;
end;
$$;
