import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { colors } from '../theme'

export default function TopBar({ title }) {
  const { household, signOut } = useAuth()

  return (
    <header style={styles.header}>
      <div>
        <p style={styles.title}>{title}</p>
        <Link to="/household" style={styles.subtitle}>
          {household?.name}
        </Link>
      </div>
      <button style={styles.signOut} onClick={signOut}>
        Sign out
      </button>
    </header>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '1.25rem 1.25rem 0.75rem 1.25rem',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    fontWeight: 700,
  },
  subtitle: {
    display: 'inline-block',
    margin: 0,
    color: colors.mutedText,
    fontSize: '0.85rem',
    textDecoration: 'underline',
    textDecorationColor: colors.border,
  },
  signOut: {
    padding: '0.4rem 0.6rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '0.5rem',
    background: colors.card,
    color: colors.mutedText,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
}
