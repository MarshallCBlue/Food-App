-- Fridge Magnet for Claude: lets you run the shopping list and the
-- cupboards by chatting to Claude.
--
-- How the pieces fit:
--   Claude  ->  fridge-magnet-mcp Edge Function  ->  the functions below
--
-- The Edge Function signs in to the database with the server-only key,
-- which skips Row Level Security. So nothing here trusts a household id
-- it is merely told: every function below checks that each row it
-- touches belongs to the household the connector's key unlocks, and only
-- the server can call them (anon and signed-in app users cannot).
--
-- All arithmetic on amounts happens here, in Postgres, for the same
-- reason as adjust_inventory_quantity: numeric maths is exact, JavaScript
-- maths is not.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Connector keys
-- ---------------------------------------------------------------------
-- One row per key. Only a fingerprint (SHA-256) of the key is stored, so
-- reading this table does not reveal any key. Revoking a key is setting
-- revoked_at; the connector stops working at once.
create table public.assistant_keys (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index assistant_keys_household_id_idx on public.assistant_keys(household_id);

-- No policies: the app never reads this table. Only the server can.
alter table public.assistant_keys enable row level security;

-- Makes a new key and returns it. The key itself is shown once, here,
-- and never stored. Run from the Supabase SQL editor:
--   select public.assistant_create_key('<household id>', 'Claude');
create or replace function public.assistant_create_key(target_household_id uuid, key_label text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_key text;
begin
  if not exists (select 1 from public.households where id = target_household_id) then
    raise exception 'No household with that id';
  end if;

  new_key := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.assistant_keys (household_id, label, key_hash)
  values (target_household_id, key_label, encode(extensions.digest(new_key, 'sha256'), 'hex'));

  return new_key;
end;
$$;

-- The connector hands over a fingerprint of the key it was given and
-- gets back the household it unlocks, or nothing.
create or replace function public.assistant_household_for_key(presented_key_hash text)
returns uuid
language sql
set search_path = public
as $$
  update public.assistant_keys
  set last_used_at = now()
  where key_hash = presented_key_hash
    and revoked_at is null
  returning household_id;
$$;

-- ---------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------

-- Same rules as normaliseUnit() in src/lib/shoppingList.js, so "grams",
-- "gram" and "g" count as one unit here exactly as they do in the app.
create or replace function public.assistant_normalise_unit(unit_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when c in ('gram', 'grams') then 'g'
    when c in ('kilogram', 'kilograms', 'kilo', 'kilos') then 'kg'
    when c in ('millilitre', 'millilitres', 'milliliter', 'milliliters') then 'ml'
    when c in ('litre', 'litres', 'liter', 'liters') then 'l'
    when c in ('teaspoon', 'teaspoons') then 'tsp'
    when c in ('tablespoon', 'tablespoons') then 'tbsp'
    when length(c) > 3 and right(c, 1) = 's' then left(c, -1)
    else c
  end
  from (select regexp_replace(lower(trim(coalesce(unit_text, ''))), '\.$', '') as c) cleaned;
$$;

-- "2 Pack", "500 g", or just "3".
create or replace function public.assistant_format_amount(amount numeric, unit_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim_scale(amount)::text || coalesce(' ' || nullif(trim(unit_text), ''), '');
$$;

-- Same as joinNotes() in the app.
create or replace function public.assistant_join_notes(first_note text, second_note text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(first_note, '') is null then nullif(second_note, '')
    when nullif(second_note, '') is null or first_note = second_note then first_note
    else first_note || '; ' || second_note
  end;
$$;

-- ---------------------------------------------------------------------
-- Finding saved foods
-- ---------------------------------------------------------------------
-- Returns candidates, best first, each with how it matched:
--   exact    "milk" -> Milk
--   plural   "sweet potato" -> Sweet Potatoes
--   partial  "onion" -> Red onion, Spring Onion
--   similar  "brocoli" -> Tenderstem broccoli (spelling slips)
-- The connector only acts on its own for exact and plural matches.
-- Anything weaker goes back to you as a question.
create or replace function public.assistant_find_foods(target_household_id uuid, search_text text)
returns table (item_id uuid, name text, match_type text, score real)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select lower(trim(search_text)) as term
  ),
  variants as (
    select distinct v
    from q,
    lateral (values
      (term),
      (term || 's'),
      (term || 'es'),
      (case when term like '%ies' then left(term, -3) || 'y' end),
      (case when term like '%y' then left(term, -1) || 'ies' end),
      (case when term like '%es' then left(term, -2) end),
      (case when term like '%s' then left(term, -1) end)
    ) as t(v)
    where v is not null and v <> ''
  ),
  scored as (
    select
      it.id,
      it.name,
      case
        when it.name_key = q.term then 'exact'
        when it.name_key in (select v from variants) then 'plural'
        when it.name_key like '%' || q.term || '%' or q.term like '%' || it.name_key || '%' then 'partial'
        else 'similar'
      end as match_type,
      greatest(similarity(it.name_key, q.term), word_similarity(q.term, it.name_key)) as sim
    from public.items it, q
    where it.household_id = target_household_id
      and q.term <> ''
      and (
        it.name_key = q.term
        or it.name_key in (select v from variants)
        or it.name_key like '%' || q.term || '%'
        or q.term like '%' || it.name_key || '%'
        or similarity(it.name_key, q.term) > 0.35
        or word_similarity(q.term, it.name_key) > 0.6
      )
  )
  select
    id,
    name,
    match_type,
    (case match_type when 'exact' then 3 when 'plural' then 2 when 'partial' then 1 else 0 end + sim)::real as score
  from scored
  order by score desc, name
  limit 8;
$$;

-- ---------------------------------------------------------------------
-- Shopping list: add, or top up the line already there
-- ---------------------------------------------------------------------
-- Mirrors addOrMergeShoppingItem() in the app:
--   * only lines not yet ticked are topped up (a ticked line is already
--     in the trolley, so a fresh need is a fresh line)
--   * same unit: the amounts are added together and notes joined
--   * different unit: nothing changes until you choose, through
--     when_unit_differs:
--       'separate'   a second line
--       'add_anyway' add the numbers, keep the new unit
--       'replace'    the line becomes exactly the new amount
create or replace function public.assistant_add_to_list(
  target_household_id uuid,
  target_item_id uuid,
  add_quantity numeric,
  add_unit text,
  add_note text,
  when_unit_differs text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  food record;
  line record;
  new_quantity numeric := coalesce(add_quantity, 1);
  new_unit text := nullif(trim(add_unit), '');
  new_note text := nullif(trim(add_note), '');
  result_id uuid;
  result_quantity numeric;
  result_unit text;
begin
  select id, name into food
  from public.items
  where id = target_item_id and household_id = target_household_id;
  if not found then
    raise exception 'That food is not saved in this household';
  end if;

  if new_quantity <= 0 then
    raise exception 'The amount must be more than zero';
  end if;

  select id, quantity, unit, note into line
  from public.shopping_list_items
  where household_id = target_household_id
    and item_id = target_item_id
    and checked = false
  order by created_at
  limit 1
  for update;

  if not found then
    insert into public.shopping_list_items (household_id, item_id, quantity, unit, note)
    values (target_household_id, target_item_id, new_quantity, new_unit, new_note)
    returning id into result_id;

    return jsonb_build_object(
      'status', 'added', 'line_id', result_id, 'name', food.name,
      'now_on_list', public.assistant_format_amount(new_quantity, new_unit)
    );
  end if;

  if public.assistant_normalise_unit(line.unit) = public.assistant_normalise_unit(new_unit) then
    update public.shopping_list_items
    set quantity = quantity + new_quantity,
        unit = coalesce(unit, new_unit),
        note = public.assistant_join_notes(note, new_note)
    where id = line.id
    returning quantity, unit into result_quantity, result_unit;

    return jsonb_build_object(
      'status', 'topped_up', 'line_id', line.id, 'name', food.name,
      'was', public.assistant_format_amount(line.quantity, line.unit),
      'now_on_list', public.assistant_format_amount(result_quantity, result_unit)
    );
  end if;

  if when_unit_differs is null then
    return jsonb_build_object(
      'status', 'needs_clarification',
      'name', food.name,
      'question', format(
        '%s is already on the list as %s. Should %s go on as a separate line, be added to the same line as %s, or replace the amount on the list?',
        food.name,
        public.assistant_format_amount(line.quantity, line.unit),
        public.assistant_format_amount(new_quantity, new_unit),
        public.assistant_format_amount(line.quantity + new_quantity, new_unit)
      ),
      'answer_with', 'Call add_to_shopping_list again for this food with when_unit_differs set to separate, add_anyway or replace.'
    );
  end if;

  if when_unit_differs = 'separate' then
    insert into public.shopping_list_items (household_id, item_id, quantity, unit, note)
    values (target_household_id, target_item_id, new_quantity, new_unit, new_note)
    returning id into result_id;

    return jsonb_build_object(
      'status', 'added_separate_line', 'line_id', result_id, 'name', food.name,
      'now_on_list', public.assistant_format_amount(new_quantity, new_unit),
      'other_line', public.assistant_format_amount(line.quantity, line.unit)
    );
  end if;

  if when_unit_differs = 'add_anyway' then
    result_quantity := line.quantity + new_quantity;
  elsif when_unit_differs = 'replace' then
    result_quantity := new_quantity;
  else
    raise exception 'when_unit_differs must be separate, add_anyway or replace';
  end if;

  update public.shopping_list_items
  set quantity = result_quantity,
      unit = new_unit,
      note = public.assistant_join_notes(note, new_note)
  where id = line.id;

  return jsonb_build_object(
    'status', case when when_unit_differs = 'replace' then 'replaced' else 'topped_up' end,
    'line_id', line.id, 'name', food.name,
    'was', public.assistant_format_amount(line.quantity, line.unit),
    'now_on_list', public.assistant_format_amount(result_quantity, new_unit)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Stock: add, or top up the batch already there
-- ---------------------------------------------------------------------
-- One batch per food, per place, per use-by date (the database's own
-- rule). Same unit: amounts are added. Different unit (including "no
-- unit" against "tins"): nothing changes until you choose, through
-- when_unit_differs:
--   'add_anyway' add the numbers, keep the new unit
--   'replace'    the batch becomes exactly the new amount
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
  result_id uuid;
  result_quantity numeric;
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

  if public.assistant_normalise_unit(batch.unit) <> public.assistant_normalise_unit(new_unit) then
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

  update public.inventory_items
  set quantity = result_quantity,
      unit = coalesce(new_unit, unit)
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
    'now_in_stock', public.assistant_format_amount(result_quantity, coalesce(new_unit, batch.unit)),
    'use_by', use_by
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Stock: using things up
-- ---------------------------------------------------------------------
-- use_quantity null means "all gone".
-- Narrow it down with from_location_id or target_stock_id. When the food
-- is kept in more than one place and neither is given, nothing changes
-- and you are asked which. Within one place, the batch with the soonest
-- use-by date is used first (the same rule as cooking a recipe).
-- An amount in a different unit from the stock ("200 g" of "1 Pack")
-- is never guessed at: you are asked instead.
create or replace function public.assistant_use_stock(
  target_household_id uuid,
  target_item_id uuid,
  use_quantity numeric,
  use_unit text,
  from_location_id uuid default null,
  target_stock_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  food record;
  batch record;
  batches jsonb;
  place_count integer;
  unit_count integer;
  stock_unit text;
  stock_total numeric;
  remaining numeric;
  taking numeric;
  used_total numeric := 0;
  batches_text text;
  left_over jsonb;
  on_list boolean;
begin
  select id, name into food
  from public.items
  where id = target_item_id and household_id = target_household_id;
  if not found then
    raise exception 'That food is not saved in this household';
  end if;

  if use_quantity is not null and use_quantity <= 0 then
    raise exception 'The amount used must be more than zero';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ii.id, 'quantity', ii.quantity, 'unit', ii.unit, 'expires_on', ii.expires_on,
           'place', l.name, 'location_id', ii.location_id, 'created_at', ii.created_at)), '[]'::jsonb)
    into batches
  from public.inventory_items ii
  join public.locations l on l.id = ii.location_id
  where ii.household_id = target_household_id
    and ii.item_id = target_item_id
    and (from_location_id is null or ii.location_id = from_location_id)
    and (target_stock_id is null or ii.id = target_stock_id);

  if batches = '[]'::jsonb then
    return jsonb_build_object(
      'status', 'not_in_stock', 'name', food.name,
      'message', format('There is no %s in stock%s.', food.name,
        case when from_location_id is null then '' else ' in that place' end)
    );
  end if;

  select string_agg(
           public.assistant_format_amount(quantity, unit) || ' in the ' || place
             || coalesce(' (use by ' || to_char(expires_on, 'FMDD Mon') || ')', ''),
           '; ' order by place, expires_on nulls last),
         count(distinct location_id),
         count(distinct public.assistant_normalise_unit(unit))
    into batches_text, place_count, unit_count
  from jsonb_to_recordset(batches) as b(quantity numeric, unit text, expires_on date, place text, location_id uuid);

  if place_count > 1 then
    return jsonb_build_object(
      'status', 'needs_clarification', 'name', food.name,
      'question', format('%s is kept in more than one place: %s. Which one did this come from?', food.name, batches_text),
      'answer_with', 'Call use_stock again with location set to the place they choose.'
    );
  end if;

  if unit_count > 1 then
    return jsonb_build_object(
      'status', 'needs_clarification', 'name', food.name,
      'question', format('%s is stored in different units: %s. Which batch was it?', food.name, batches_text),
      'answer_with', 'Call use_stock again with stock_id for the batch they mean (get_stock lists them).'
    );
  end if;

  select min(unit), sum(quantity) into stock_unit, stock_total
  from jsonb_to_recordset(batches) as b(quantity numeric, unit text);

  if use_quantity is not null
     and public.assistant_normalise_unit(use_unit) <> public.assistant_normalise_unit(stock_unit) then
    return jsonb_build_object(
      'status', 'needs_clarification', 'name', food.name,
      'question', format(
        'The stock of %s is %s, so I can''t take off %s without guessing. Did you use all of it, or how much is left?',
        food.name, batches_text, public.assistant_format_amount(use_quantity, use_unit)
      ),
      'answer_with', 'Call use_stock with no quantity if it is all gone, or update_stock with the amount left.'
    );
  end if;

  remaining := coalesce(use_quantity, stock_total);

  for batch in
    select *
    from jsonb_to_recordset(batches) as b(id uuid, quantity numeric, unit text, expires_on date, created_at timestamptz)
    order by expires_on asc nulls last, created_at asc
  loop
    exit when remaining <= 0;
    taking := least(remaining, batch.quantity);

    if batch.quantity - taking <= 0 then
      delete from public.inventory_items where id = batch.id;
      insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
      values (target_household_id, target_item_id, null, -batch.quantity,
              case when use_quantity is null then 'clear' else 'use' end, 'via Claude');
    else
      update public.inventory_items set quantity = quantity - taking where id = batch.id;
      insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
      values (target_household_id, target_item_id, batch.id, -taking, 'use', 'via Claude');
    end if;

    remaining := remaining - taking;
    used_total := used_total + taking;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'stock_id', ii.id,
           'place', l.name,
           'amount', public.assistant_format_amount(ii.quantity, ii.unit),
           'use_by', ii.expires_on)), '[]'::jsonb)
    into left_over
  from public.inventory_items ii
  join public.locations l on l.id = ii.location_id
  where ii.household_id = target_household_id and ii.item_id = target_item_id;

  select exists (
    select 1 from public.shopping_list_items
    where household_id = target_household_id and item_id = target_item_id and checked = false
  ) into on_list;

  return jsonb_build_object(
    'status', 'used',
    'name', food.name,
    'used', public.assistant_format_amount(used_total, stock_unit),
    'asked_for_more_than_there_was', use_quantity is not null and use_quantity > used_total,
    'left_in_stock', left_over,
    'ran_out', left_over = '[]'::jsonb,
    'already_on_shopping_list', on_list
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Stock: corrections, moving, and use-by dates
-- ---------------------------------------------------------------------
-- changes is an object; only the keys present are changed:
--   quantity   the correct amount now (0 removes the batch)
--   unit       text, or null for no unit
--   location_id
--   use_by     'YYYY-MM-DD', or null to remove the date
-- Moving a batch onto one that already exists (same food, place and
-- date) joins them when the units match, and is refused when not.
create or replace function public.assistant_update_stock(
  target_household_id uuid,
  target_stock_id uuid,
  changes jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  batch record;
  food_name text;
  new_quantity numeric;
  new_unit text;
  new_location uuid;
  new_use_by date;
  place_name text;
  other record;
  delta numeric;
begin
  select * into batch
  from public.inventory_items
  where id = target_stock_id and household_id = target_household_id
  for update;
  if not found then
    raise exception 'That stock entry is not in this household (it may already have been used up)';
  end if;

  select name into food_name from public.items where id = batch.item_id;

  new_quantity := case when changes ? 'quantity' then (changes ->> 'quantity')::numeric else batch.quantity end;
  new_unit := case when changes ? 'unit' then nullif(trim(changes ->> 'unit'), '') else batch.unit end;
  new_location := case when changes ? 'location_id' then (changes ->> 'location_id')::uuid else batch.location_id end;
  new_use_by := case when changes ? 'use_by' then (changes ->> 'use_by')::date else batch.expires_on end;

  if new_quantity is null then
    raise exception 'Give the amount as a number';
  end if;

  if new_quantity < 0 then
    raise exception 'The amount cannot be below zero';
  end if;

  select name into place_name
  from public.locations
  where id = new_location and household_id = target_household_id;
  if not found then
    raise exception 'That storage place is not in this household';
  end if;

  delta := new_quantity - batch.quantity;

  if new_quantity = 0 then
    delete from public.inventory_items where id = batch.id;
    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
    values (target_household_id, batch.item_id, null, -batch.quantity, 'clear', 'correction via Claude');
    return jsonb_build_object('status', 'removed', 'name', food_name,
                              'was', public.assistant_format_amount(batch.quantity, batch.unit));
  end if;

  -- Is there already a batch where this one is going?
  if new_location <> batch.location_id or new_use_by is distinct from batch.expires_on then
    select id, quantity, unit into other
    from public.inventory_items
    where household_id = target_household_id
      and item_id = batch.item_id
      and location_id = new_location
      and expires_on is not distinct from new_use_by
      and id <> batch.id
    for update;

    if found then
      if public.assistant_normalise_unit(other.unit) <> public.assistant_normalise_unit(new_unit) then
        raise exception 'There is already % of % in the % with that use-by date, in a different unit. Correct one of them first, then move it.',
          public.assistant_format_amount(other.quantity, other.unit), food_name, place_name;
      end if;

      update public.inventory_items
      set quantity = quantity + new_quantity, unit = coalesce(unit, new_unit)
      where id = other.id;
      delete from public.inventory_items where id = batch.id;

      if delta <> 0 then
        insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
        values (target_household_id, batch.item_id, other.id, delta,
                case when delta > 0 then 'manual_add' else 'use' end, 'correction via Claude');
      end if;

      return jsonb_build_object(
        'status', 'joined', 'name', food_name, 'stock_id', other.id, 'place', place_name,
        'now_in_stock', public.assistant_format_amount(other.quantity + new_quantity, coalesce(other.unit, new_unit)),
        'use_by', new_use_by
      );
    end if;
  end if;

  update public.inventory_items
  set quantity = new_quantity, unit = new_unit, location_id = new_location, expires_on = new_use_by
  where id = batch.id;

  if delta <> 0 then
    insert into public.stock_events (household_id, item_id, inventory_item_id, change_amount, event_type, note)
    values (target_household_id, batch.item_id, batch.id, delta,
            case when delta > 0 then 'manual_add' else 'use' end, 'correction via Claude');
  end if;

  return jsonb_build_object(
    'status', 'updated', 'name', food_name, 'stock_id', batch.id, 'place', place_name,
    'now_in_stock', public.assistant_format_amount(new_quantity, new_unit),
    'use_by', new_use_by
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------
-- assistant_create_key: nobody but you, from the SQL editor.
-- Everything else: only the server (the Edge Function).
revoke all on function public.assistant_create_key(uuid, text) from public, anon, authenticated, service_role;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.assistant_household_for_key(text)',
    'public.assistant_normalise_unit(text)',
    'public.assistant_format_amount(numeric, text)',
    'public.assistant_join_notes(text, text)',
    'public.assistant_find_foods(uuid, text)',
    'public.assistant_add_to_list(uuid, uuid, numeric, text, text, text)',
    'public.assistant_add_to_stock(uuid, uuid, uuid, numeric, text, date, text)',
    'public.assistant_use_stock(uuid, uuid, numeric, text, uuid, uuid)',
    'public.assistant_update_stock(uuid, uuid, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
