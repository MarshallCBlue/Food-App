-- Realtime's household_id=eq.<id> filter has to be evaluated against
-- whatever a change's payload actually contains. For UPDATE/INSERT that's
-- always the full new row, but for DELETE only the primary key travels by
-- default — so a delete's payload never has household_id in it, the
-- filter can't match, and the notification is silently dropped. FULL
-- keeps the whole old row available so deletes get filtered correctly too.
alter table public.categories replica identity full;
alter table public.shopping_list_items replica identity full;
