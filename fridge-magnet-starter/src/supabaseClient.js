import { createClient } from '@supabase/supabase-js'

// These two values identify which Supabase project this app talks to.
// import.meta.env.* reads them from environment variables rather than
// having them typed directly into this file — on your own computer that
// means the .env file, and on the live site it means the values you type
// into Netlify's dashboard. Either way, this file itself never contains a
// real key, which matters because this repository is public.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // This warning only ever appears in the browser's own developer console,
  // never to a visitor, and only if the two settings above are missing.
  console.warn(
    'Supabase is not configured yet. Add VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY as environment variables.'
  )
}

// Every other file in the app imports this one client, rather than each
// creating its own, so they all share the same connection and the same
// signed-in user.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
