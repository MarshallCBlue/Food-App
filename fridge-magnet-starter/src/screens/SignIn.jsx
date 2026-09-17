import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import Screen from '../components/Screen'
import { colors } from '../theme'

export default function SignIn() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    try {
      if (mode === 'signIn') {
        await signIn(email, password)
      } else {
        const data = await signUp(email, password)
        if (!data.session) {
          setMessage('Check your email to confirm your account, then sign in below.')
          setMode('signIn')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <h1 style={styles.heading}>🧲 Fridge Magnet</h1>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h2 style={styles.cardHeading}>
          {mode === 'signIn' ? 'Sign in' : 'Create your account'}
        </h2>

        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.message}>{message}</p>}

        <button style={styles.primaryButton} type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>

        <button
          style={styles.linkButton}
          type="button"
          onClick={() => {
            setError(null)
            setMessage(null)
            setMode(mode === 'signIn' ? 'signUp' : 'signIn')
          }}
        >
          {mode === 'signIn' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </button>
      </form>
    </Screen>
  )
}

const styles = {
  heading: {
    fontSize: '2rem',
    margin: 0,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '100%',
    maxWidth: '22rem',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    background: colors.card,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  cardHeading: {
    margin: '0 0 0.25rem 0',
  },
  input: {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '1rem',
  },
  primaryButton: {
    padding: '0.85rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  linkButton: {
    padding: '0.25rem',
    border: 'none',
    background: 'none',
    color: colors.primary,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  error: {
    color: colors.danger,
    margin: 0,
    fontSize: '0.9rem',
  },
  message: {
    color: colors.mutedText,
    margin: 0,
    fontSize: '0.9rem',
  },
}
