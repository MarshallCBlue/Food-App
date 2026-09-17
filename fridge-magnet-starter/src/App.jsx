import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// This is a placeholder home screen. Its only job right now is to prove
// that the app is live and that it can successfully reach the Fridge
// Magnet Supabase project. The shopping list, inventory and NFC screens
// arrive in later steps of the build.
export default function App() {
  // "connected" starts as null (meaning "still checking"), then becomes
  // true or false once we hear back from Supabase.
  const [connected, setConnected] = useState(null)

  useEffect(() => {
    // getSession() asks Supabase "is anyone signed in right now?". We are
    // not using the answer yet — we only care that Supabase replied at
    // all, which tells us the connection details are correct.
    supabase.auth
      .getSession()
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>🧲 Fridge Magnet</h1>
      <p style={styles.subheading}>Shopping list, inventory, and one tap on the fridge.</p>

      <div style={styles.statusCard}>
        {connected === null && <p>Checking connection to Supabase…</p>}
        {connected === true && <p>✅ Connected to Supabase.</p>}
        {connected === false && (
          <p>
            ⚠️ Could not reach Supabase. Check that VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY are set in Netlify's environment
            variables.
          </p>
        )}
      </div>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    color: '#1a2e22',
    background: '#f4f8f5',
  },
  heading: {
    fontSize: '2rem',
    margin: 0,
  },
  subheading: {
    margin: 0,
    color: '#4a5f52',
  },
  statusCard: {
    marginTop: '1rem',
    padding: '0.9rem 1.2rem',
    borderRadius: '0.75rem',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    maxWidth: '22rem',
  },
}
