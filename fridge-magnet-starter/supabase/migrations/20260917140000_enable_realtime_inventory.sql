-- Same reasoning as the shopping-list fix: FULL up front so deletes (which
-- get filtered by household_id, not the primary key) are actually
-- delivered to other phones in the household from day one.
alter table public.locations replica identity full;
alter table public.inventory_items replica identity full;

alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.inventory_items;
