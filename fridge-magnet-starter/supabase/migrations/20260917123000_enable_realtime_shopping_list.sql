-- Lets phones in the same household hear about shopping-list and aisle
-- changes as they happen. Realtime respects each table's Row Level
-- Security automatically, so this only ever notifies the household the
-- change belongs to.
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.shopping_list_items;
