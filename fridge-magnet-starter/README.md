# Fridge Magnet

A personal shopping list and kitchen inventory app. Check items off a
categorised shopping list, then tap your phone on an NFC tag stuck to the
fridge to move everything you bought straight into your inventory.

Built with React, Supabase (PostgreSQL), and Netlify — entirely on free-tier
usage.

## Status

Step 1 (accounts wired together) and Step 2 (database) are done.

The database lives in `supabase/migrations/`. It has all ten tables from
the build plan — households, membership, categories, locations, the item
catalogue, the shopping list, inventory, a stock-event log, push
subscriptions and sync runs — every one of them locked with Row Level
Security so a household only ever sees its own rows. Creating a household
seeds it with the standard aisles and storage locations automatically.

The shopping list, inventory, barcode scanner and NFC sync screens are
built in the steps that follow — see the full build plan for the roadmap.

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
