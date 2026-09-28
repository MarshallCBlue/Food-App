-- The meal planner. Each row is one meal on one day: either one of the
-- household's recipes, or just a typed title ("Takeaway", "Leftovers").
--
-- title is always filled in, even for a recipe, so the plan still reads
-- sensibly if that recipe is later deleted (recipe_id is then cleared,
-- and the meal stays on the plan under its old name).
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  planned_on date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

-- The planner always asks for "this household, these seven days".
create index meal_plan_entries_household_date_idx on public.meal_plan_entries(household_id, planned_on);
create index meal_plan_entries_recipe_id_idx on public.meal_plan_entries(recipe_id);

alter table public.meal_plan_entries enable row level security;

-- Same rule as every other table: your own household, or any household
-- if you are an admin.
create policy meal_plan_household_access
  on public.meal_plan_entries
  for all
  to authenticated
  using (household_id in (select public.current_household_ids()) or (select public.is_admin()))
  with check (household_id in (select public.current_household_ids()) or (select public.is_admin()));

-- Live updates, so a meal planned on one phone appears on the other.
-- FULL replica identity so deletes still carry household_id for the
-- realtime filter (the same lesson as the other tables).
alter table public.meal_plan_entries replica identity full;
alter publication supabase_realtime add table public.meal_plan_entries;
