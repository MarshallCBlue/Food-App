# Fridge Magnet

A personal shopping list and kitchen inventory app. Check items off a
categorised shopping list, then tap your phone on an NFC tag stuck to the
fridge to move everything you bought straight into your inventory.

Built with React, Supabase (PostgreSQL), and Netlify — entirely on free-tier
usage.

## Status

Steps 1–9 are done, plus two pieces of Step 11 taken out of order (recipes
and email invites) at the household's request — Step 10 (polish) is
skipped for now.

The database lives in `supabase/migrations/`. It has all ten tables from
the build plan — households, membership, categories, locations, the item
catalogue, the shopping list, inventory, a stock-event log, push
subscriptions and sync runs — every one of them locked with Row Level
Security so a household only ever sees its own rows. Creating a household
seeds it with the standard aisles and storage locations automatically.

Signing in works, first-time sign-up creates an account, and from there
you either create a household (and get a six-character code to hand to
whoever else should join) or join one with a code.

The shopping list groups items under their aisle, A to Z, with ticked
items greyed out and sunk to the bottom of their group. Typing an item's
name suggests matches from your own catalogue — pick one and its aisle
and usual unit come with it; type something new and you're asked which
aisle it lives in, just that once. Tapping a row lets you change its
quantity, unit or note, or remove it. Aisles themselves can be added,
renamed, reordered and deleted from the "Edit aisles" link. Everything
updates live on every phone in the household via Supabase Realtime.

The inventory groups items under Cupboard/Drawer/Fridge/Freezer the same
way, with a small "add to inventory" form for putting things in directly,
alongside the barcode scanner and the NFC tap as the two automatic
routes in. Each row can have a specific amount taken off, or be cleared in
one tap; running out offers a one-tap "add to shopping list" instead of
just vanishing. Every change is logged to `stock_events`, and the
arithmetic behind "take some off" runs inside Postgres itself rather than
in the browser, so repeated use can't drift a quantity away from its true
value the way ordinary floating-point subtraction would. Locations can be
added, renamed and deleted from the "Edit locations" link.

The Scan tab opens the camera and reads a barcode automatically — Android
Chrome's own built-in reader when it's available, a JavaScript decoder
(ZXing) otherwise, since Safari has none built in. A manual "enter barcode
instead" link covers cameras that won't cooperate. Once read, a barcode is
looked up in this order: your own catalogue first (instant), then Open
Food Facts (a free public product database) for its name and a best-guess
aisle from its category tags, and only if both come up empty do you type
the name yourself — either way it's saved against that barcode, so the
lookup only ever happens once per product. From there it's one tap to add
to the shopping list or straight into the inventory.

Tapping your name in the header opens a Household screen with your join
code and the ready-made address to write onto an NFC sticker (NTAG213 or
better) with a free app like NFC Tools. Tapping that tag opens `/sync`,
which shows exactly what's about to move — every checked item, asking
only for a location on the few that don't already have one — and does
nothing until you confirm. The whole move happens in one all-or-nothing
database transaction, and an Undo button afterwards reverses it: items go
back on the list, checked, and the same amount comes back out of wherever
it landed (if that inventory's still there to take it from — it might not
be, if some has already been used since).

The app is a proper installable PWA now, not just a browser bookmark: a
web app manifest and a service worker (via `vite-plugin-pwa`) mean phones
offer a real "install" rather than a plain shortcut, with its own icon,
name and no browser address bar — the exact thing Step 9's iPhone
notifications will depend on. The service worker only ever caches the
app's own code, never anything from Supabase, so there's no risk of it
serving stale shopping-list data — this app has no offline mode yet
(that's still a possible later step), it's just properly installable.

Any inventory item can now carry an optional use-by date — set it when
adding manually, or scanning offers it as a quick choice for chilled and
fresh goods specifically (dairy, meat, chilled, frozen, fruit & veg) and
stays out of the way for tins; a date can also be added or changed later
from a row's own panel. The new **Expiring** link (next to "Edit
locations") groups everything within a week into Past their date / Next 3
days / This week, oldest first — colour marks the urgency, but every row
also says it in words ("2 days left"), so it still reads if you're
colour-blind or the phone's in bright sun.

An install banner now appears across the top of the app until it's
installed (or dismissed) — Android gets a real one-tap "Install app"
button; iPhone gets the Share-button instructions Safari requires instead,
since there's no way to trigger that dialog from a web page. The same
instructions live permanently on the Household screen for anyone who
dismissed the banner and changed their mind.

Once installed, the Household screen's Reminders section turns on one
notification a day, around 8am, if anything's expiring within three
days — never one per item. A `send-expiry-reminders` Edge Function
(`supabase/functions/`) does the actual sending over Web Push (the
standard both Apple and Google support), triggered daily by a `pg_cron`
job; the service worker's own `push` handler is what turns that into
something visible on the phone even if the app isn't open. See **Finishing
this setup** below — manual configuration this build plan can't do on its
own behalf.

A **Recipes** link (next to "Expiring" on the Inventory screen) manages a
household's recipes — a name plus a list of ingredients, each tied to the
same catalogue used everywhere else. "Cook this recipe" shows what it
needs against what's actually in stock before touching anything, then
consumes it: oldest use-by date first, across as many inventory batches
as it takes, using whatever's there even if it's not quite enough — a
recipe you're short one ingredient for still cooks, it just tells you
what came up short afterwards, with a checkbox per item to add exactly
the ones you choose to the shopping list, not an all-or-nothing dump.

The Household screen can now also invite someone by email instead of
reading a six-character code out loud — they get a link to set a password
and land straight in the shared household, no code entry at all. See
**Finishing this setup** below for the one small piece of configuration
this needs.

Step 10 (polish) and the rest of Step 11 (offline shopping list, a
"you're due for milk" suggestion) remain undone — see the full build plan
for the roadmap.

## Finishing this setup

### Email invites (new)

**In Supabase** (Project Settings → Edge Functions → Secrets), add:

| Key | Value |
|---|---|
| `APP_URL` | Your live site's address, e.g. `https://fridgemagnet.netlify.app` — this is where the invite email's link sends someone once they've set a password |

That's the only new secret this needs — `SUPABASE_URL`, `SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` are already provided to every Edge Function
automatically.

One honest limitation: Supabase's own built-in email sending (what
`admin.inviteUserByEmail` uses) is rate-limited on the free tier — fine
for a household inviting the odd person now and then, not for sending
invites in bulk. If that ever becomes a problem, the fix is configuring a
proper SMTP provider in Supabase's Auth settings, which is a dashboard
change, not a code change.

### Reminders (Step 9)

Reminders need two things set outside this repository, since they're
secrets and this repository is public.

**In Netlify** (Site settings → Environment variables), add:

| Key | Value |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | `BEPVetMT6MEvEph3DGypVvQh8olKfhCzGjt6ra1U0OTO5a0UdvuO0HQGV3IVXg8Mjp_iykpOjEC50C1uN3XapsY` |

Then **Deploys → Trigger deploy → Deploy site**, same as any other env
var change.

**In Supabase** (Project Settings → Edge Functions → Secrets), add:

| Key | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `BEPVetMT6MEvEph3DGypVvQh8olKfhCzGjt6ra1U0OTO5a0UdvuO0HQGV3IVXg8Mjp_iykpOjEC50C1uN3XapsY` |
| `VAPID_PRIVATE_KEY` | Run `select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key_for_reference';` in the Supabase SQL editor and paste what comes back — never written here, since unlike the public key, this one is genuinely secret |
| `VAPID_SUBJECT` | `mailto:you@example.com` (any contact address — required by the Web Push standard, shown to push services, never to the person receiving the notification) |
| `CRON_SECRET` | Run `select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_for_expiry_reminders';` in the Supabase SQL editor and paste what comes back |

No redeploy needed for these — Edge Functions pick up new secrets on
their next invocation. Once both are set, visit the Household screen on
your phone (installed to the home screen first — that's the whole point
of Step 9's first half) and tap "Turn on reminders".

## Running this on your own computer (optional)

You do not need to do this to use the live app. If you want to run a copy
on your own machine:

```bash
npm install
cp .env.example .env   # then fill in the real Supabase anon key
npm run dev
```

## Environment variables

The app needs two values to reach its database:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

On the live site these are set in Netlify's dashboard under **Site
settings → Environment variables**, not in this repository, because this
repository is public.
