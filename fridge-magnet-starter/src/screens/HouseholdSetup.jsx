import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import { supabase } from '../supabaseClient'
import Screen from '../components/Screen'
import Icon from '../components/Icon'

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
      <Screen title={`${created.name} is set up`} subtitle="One code, one shared list.">
        <div className="fm-centre__card" style={{ textAlign: 'center' }}>
          <p className="fm-note">Share this with anyone else who should see the same list:</p>
          <p className="fm-code">{created.secret_code}</p>
          <button className="fm-btn fm-btn--block" onClick={refreshHousehold}>
            Start using Fridge Magnet
          </button>
        </div>
      </Screen>
    )
  }

  if (mode === 'create') {
    return (
      <Screen title="Name your household" subtitle="Whatever you would call it out loud.">
        <form onSubmit={handleCreate} className="fm-centre__card">
          <input
            className="fm-field"
            placeholder="e.g. The Marshalls"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Household name"
            required
          />
          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}
          <button className="fm-btn fm-btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Creating' : 'Create household'}
          </button>
          <button className="fm-btn fm-btn--quiet fm-btn--block" type="button" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      </Screen>
    )
  }

  if (mode === 'join') {
    return (
      <Screen title="Join a household" subtitle="Type the six-character code you were given.">
        <form onSubmit={handleJoin} className="fm-centre__card">
          <input
            className="fm-field"
            style={{ textAlign: 'center', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}
            placeholder="ABC123"
            value={code}
            maxLength={6}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            aria-label="Household code"
            required
          />
          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}
          <button className="fm-btn fm-btn--block" type="submit" disabled={submitting}>
            {submitting ? 'Joining' : 'Join household'}
          </button>
          <button className="fm-btn fm-btn--quiet fm-btn--block" type="button" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      </Screen>
    )
  }

  return (
    <Screen
      title="Almost there"
      subtitle="Is this your first Fridge Magnet, or is someone in the house already using one?"
    >
      <div className="fm-centre__card">
        <button className="fm-btn fm-btn--block" onClick={() => setMode('create')}>
          <Icon name="home" />
          Start a household
        </button>
        <button className="fm-btn fm-btn--secondary fm-btn--block" onClick={() => setMode('join')}>
          Join with a code
        </button>
        <button className="fm-btn fm-btn--quiet fm-btn--block" onClick={signOut}>
          Sign out
        </button>
      </div>
    </Screen>
  )
}
