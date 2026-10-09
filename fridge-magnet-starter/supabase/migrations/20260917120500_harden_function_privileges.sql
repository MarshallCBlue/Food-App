-- Recorded from the live database on 2026-10-09: this change was applied
-- to Supabase on 17 Sep 2026 but never saved here. It is already live, so
-- it does not need running again.
--
-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default. current_household_ids() is only meaningful once signed in, and
-- create_household/join_household should only ever be called signed in,
-- so anon's ability to call them (harmlessly, since they'd fail or return
-- nothing without a session) is removed for a clean security report.

revoke all on function public.current_household_ids() from public, anon;
grant execute on function public.current_household_ids() to authenticated;

revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

revoke all on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- Pin the search path so this trigger function can't be tricked by a
-- session that has changed its search_path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
