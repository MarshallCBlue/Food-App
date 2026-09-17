# Fridge Magnet

A personal shopping list and kitchen inventory app. Check items off a
categorised shopping list, then tap your phone on an NFC tag stuck to the
fridge to move everything you bought straight into your inventory.

Built with React, Supabase (PostgreSQL), and Netlify — entirely on free-tier
usage.

## Status

Steps 1–4 are done: accounts wired together, the database, the app shell
with sign-in, and the shopping list.

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

The inventory, barcode scanner and NFC sync screens are built in the
steps that follow — see the full build plan for the roadmap.

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
