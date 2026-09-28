-- The invite trigger added a new user to whatever household their
-- sign-up metadata named. That metadata is written by whoever signs up —
-- the app's own sign-up form doesn't send it, but anyone calling Supabase
-- directly could — so a stranger who learned a household's id could put
-- it there and walk straight in.
--
-- The invite-household-member Edge Function now adds the membership
-- itself, with the service role, after Supabase has created the invited
-- account. Nothing needs to read metadata any more.
drop trigger if exists on_auth_user_created_join_household on auth.users;
drop function if exists public.handle_invited_user();
