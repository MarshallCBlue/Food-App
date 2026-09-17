-- Step 11 (partial): household invites by email. The Edge Function sends
-- the invite via Supabase's own admin.inviteUserByEmail, stashing which
-- household it was for in the new user's metadata. Supabase creates the
-- auth.users row immediately (before the person has even opened the
-- email), so this trigger runs then — by the time they click the link
-- and finish signing in, their household membership already exists and
-- the app never shows them "create or join a household" at all.
create or replace function public.handle_invited_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_household_id uuid;
begin
  invited_household_id := (new.raw_user_meta_data ->> 'invited_household_id')::uuid;

  if invited_household_id is not null then
    insert into public.household_members (household_id, user_id)
    values (invited_household_id, new.id)
    on conflict (household_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created_join_household
  after insert on auth.users
  for each row execute function public.handle_invited_user();

-- Only ever meant to run as this trigger, which doesn't need (or check)
-- any EXECUTE grant on the calling role — the default grant to
-- anon/authenticated new functions get was unnecessary exposure here,
-- consistent with how every other function in this project is locked
-- down to just what actually needs to call it.
revoke all on function public.handle_invited_user() from public, anon, authenticated;
