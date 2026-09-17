import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import { supabase } from '../supabaseClient'
import Screen from '../components/Screen'
import { colors } from '../theme'

// Shown once someone is signed in but belongs to no household yet. They
// either start one (and get a code to hand to whoever else should join)
// or join one with a code someone else already has.
export default function HouseholdSetup() {
  const { createHousehold, joinHousehold, refreshHousehold, signOut } = useAuth()
  const [mode, setMode] = useState('choose')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  async function handleCreate(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const householdId = await createHousehold(name.trim())
      const { data, error: fetchError } = await supabase
        .from('households')
        .select('name, secret_code')
        .eq('id', householdId)
        .single()
      if (fetchError) throw fetchError
      setCreated(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoin(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await joinHousehold(code.trim())
      await refreshHousehold()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <Screen>
        <h1 style={styles.heading}>🧲 {created.name} is set up</h1>
        <div style={styles.card}>
          <p style={styles.bodyText}>
            Share this code with anyone else who should see the same list:
          </p>
          <p style={styles.code}>{created.secret_code}</p>
          <button style={styles.primaryButton} onClick={refreshHousehold}>
            Continue to Fridge Magnet
          </button>
        </div>
      </Screen>
    )
  }

  if (mode === 'create') {
    return (
      <Screen>
        <h1 style={styles.heading}>🧲 New household</h1>
        <form onSubmit={handleCreate} style={styles.card}>
          <input
            style={styles.input}
            placeholder="e.g. The Marshalls"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create household'}
          </button>
          <button style={styles.linkButton} type="button" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      </Screen>
    )
  }

  if (mode === 'join') {
    return (
      <Screen>
        <h1 style={styles.heading}>🧲 Join a household</h1>
        <form onSubmit={handleJoin} style={styles.card}>
          <input
            style={{ ...styles.input, ...styles.codeInput }}
            placeholder="ABC123"
            value={code}
            maxLength={6}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? 'Joining…' : 'Join household'}
          </button>
          <button style={styles.linkButton} type="button" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      </Screen>
    )
  }

  return (
    <Screen>
      <h1 style={styles.heading}>🧲 Almost there</h1>
      <div style={styles.card}>
        <p style={styles.bodyText}>Is this your first Fridge Magnet, or is someone already using one?</p>
        <button style={styles.primaryButton} onClick={() => setMode('create')}>
          Create a household
        </button>
        <button style={styles.secondaryButton} onClick={() => setMode('join')}>
          Join with a code
        </button>
        <button style={styles.linkButton} onClick={signOut}>
          Sign out
        </button>
      </div>
    </Screen>
  )
}

const styles = {
  heading: {
    fontSize: '1.75rem',
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
  bodyText: {
    margin: '0 0 0.25rem 0',
    color: colors.mutedText,
  },
  input: {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '1rem',
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  code: {
    fontSize: '2rem',
    fontWeight: 700,
    letterSpacing: '0.2em',
    margin: '0.25rem 0 0.75rem 0',
    color: colors.primary,
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
  secondaryButton: {
    padding: '0.85rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.primary}`,
    background: colors.card,
    color: colors.primary,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  linkButton: {
    padding: '0.25rem',
    border: 'none',
    background: 'none',
    color: colors.mutedText,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  error: {
    color: colors.danger,
    margin: 0,
    fontSize: '0.9rem',
  },
}
