import { colors } from '../theme'

// Shown instead of the app when VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY
// weren't set at build time — the single most common reason a fresh
// deploy shows a blank screen.
export default function ConfigError() {
  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>🧲 Fridge Magnet isn't configured yet</h1>
      <p style={styles.body}>
        This site is missing the settings it needs to reach its database. In
        Netlify: <strong>Site settings → Environment variables</strong>, add
      </p>
      <ul style={styles.list}>
        <li>
          <code>VITE_SUPABASE_URL</code>
        </li>
        <li>
          <code>VITE_SUPABASE_ANON_KEY</code>
        </li>
      </ul>
      <p style={styles.body}>
        then go to <strong>Deploys → Trigger deploy → Deploy site</strong>.
        Environment variables only take effect on the next build, not the
        one that already ran.
      </p>
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
    color: colors.text,
    background: colors.background,
  },
  heading: {
    fontSize: '1.5rem',
    margin: 0,
  },
  body: {
    color: colors.mutedText,
    margin: 0,
    maxWidth: '26rem',
  },
  list: {
    textAlign: 'left',
    background: colors.card,
    padding: '1rem 1.5rem',
    borderRadius: '0.5rem',
    margin: 0,
  },
}
