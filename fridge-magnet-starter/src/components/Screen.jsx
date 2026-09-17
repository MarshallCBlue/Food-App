import { colors } from '../theme'

// A centred, single-card page. Used by the screens that appear before
// there is a household to belong to — signing in, and creating or joining
// one.
export default function Screen({ children }) {
  return <main style={styles.page}>{children}</main>
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
}
