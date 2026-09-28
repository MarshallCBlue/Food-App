import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import Screen from '../components/Screen'
import Icon from '../components/Icon'

export default function SignIn() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next) {
    setError(null)
    setMessage(null)
    setMode(next)
  }

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
    <Screen title="Fridge Magnet" subtitle="Shopping list, kitchen inventory, and one tap on the fridge.">
      <form onSubmit={handleSubmit} className="fm-centre__card">
        {/* Two equal choices side by side, rather than a link hidden
            under the button. */}
        <div className="fm-segment" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signIn'}
            className={`fm-segment__option${mode === 'signIn' ? ' is-active' : ''}`}
            onClick={() => switchMode('signIn')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signUp'}
            className={`fm-segment__option${mode === 'signUp' ? ' is-active' : ''}`}
            onClick={() => switchMode('signUp')}
          >
            Create account
          </button>
        </div>

        <input
          className="fm-field"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label="Email"
          required
        />
        <input
          className="fm-field"
          type="password"
          placeholder="Password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-label="Password"
          minLength={6}
          required
        />

        {error && (
          <p className="fm-error">
            <Icon name="alert" />
            {error}
          </p>
        )}
        {message && <p className="fm-note">{message}</p>}

        <button className="fm-btn fm-btn--block" type="submit" disabled={submitting}>
          {submitting ? 'One moment' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </Screen>
  )
}
