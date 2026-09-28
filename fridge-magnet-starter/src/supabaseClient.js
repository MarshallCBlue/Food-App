import { createClient } from '@supabase/supabase-js'

// These two values identify which Supabase project this app talks to.
// import.meta.env.* reads them from environment variables rather than
// having them typed directly into this file — on your own computer that
// means the .env file, and on the live site it means the values you type
// into Netlify's dashboard. Either way, this file itself never contains a
// real key, which matters because this repository is public.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// True once both values above are actually set. main.jsx checks this
// before rendering the app at all, and shows a plain-English error screen
// instead when it's false — otherwise createClient() below throws on a
// missing value, which (uncaught, before React has drawn anything) is
// exactly what turns into a blank white page with no clue why.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured yet. Add VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY as environment variables, then redeploy.'
  )
}

// Every other file in the app imports this one client, rather than each
// creating its own, so they all share the same connection and the same
// signed-in user. The placeholders keep createClient from throwing when
// misconfigured — isSupabaseConfigured is what the app actually checks.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
)
