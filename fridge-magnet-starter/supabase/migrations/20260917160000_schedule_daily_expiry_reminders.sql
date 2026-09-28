-- Step 9: the daily reminder. pg_cron wakes up once a day and asks the
-- send-expiry-reminders Edge Function to do the actual work — the
-- database itself doesn't know how to speak the Web Push protocol.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The shared secret the Edge Function checks before doing anything,
-- since a scheduled job has no signed-in user to present a JWT. Generated
-- randomly and stored in Vault (encrypted at rest) rather than written
-- here as a literal, which — since this repository is public — would
-- otherwise publish it to anyone on GitHub. Guarded so re-running this
-- migration (e.g. against a freshly restored database) never rotates the
-- secret out from under an already-configured Edge Function.
--
-- After this runs, read the value once with:
--   select decrypted_secret from vault.decrypted_secrets
--   where name = 'cron_secret_for_expiry_reminders';
-- and set it as the CRON_SECRET Edge Function secret in the Supabase
-- dashboard (Project Settings -> Edge Functions -> Secrets) — never here.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'cron_secret_for_expiry_reminders'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'base64'),
      'cron_secret_for_expiry_reminders'
    );
  end if;
end $$;

-- 7am UTC ≈ 8am UK time while BST is in effect (as it is now). pg_cron
-- has no per-job timezone/DST support, so this drifts to 7am local once
-- the UK falls back to GMT in late October — a known, accepted
-- imprecision for a personal household app, not a bug.
select cron.schedule(
  'send-expiry-reminders-daily',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://ozvtpylsqtvmagxtetjt.supabase.co/functions/v1/send-expiry-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret_for_expiry_reminders'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
