import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import { usePushSubscription } from '../state/usePushSubscription'
import { supabase } from '../supabaseClient'
import InstallCard from '../components/InstallCard'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'

const STATUS_COPY = {
  checking: 'Checking',
  unsupported: 'Reminders are not supported in this browser.',
  denied: "Notifications are blocked for this app. You'll need to allow them again in your phone's settings.",
  error: 'Something went wrong turning reminders on.',
}

// The household's join code, its NFC tag address, reminders, and the way
// out. Reached from the cog in the top bar.
export default function HouseholdInfoScreen() {
  const { household, session, signOut } = useAuth()
  const [copied, setCopied] = useState(false)
  const { status, error, subscribe, unsubscribe } = usePushSubscription(household.id, session.user.id)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState('idle')
  const [inviteError, setInviteError] = useState(null)

  const syncUrl = `${window.location.origin}/sync?t=${household.secret_code}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(syncUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can fail (older browsers, permissions) — the
      // address is already shown on screen either way, so this is
      // cosmetic only.
    }
  }

  async function handleInvite(event) {
    event.preventDefault()
    setInviteError(null)
    setInviteStatus('sending')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('invite-household-member', {
        body: { email: inviteEmail.trim(), householdId: household.id },
      })
      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)
      setInviteStatus('sent')
      setInviteEmail('')
    } catch (err) {
      setInviteError(err.message)
      setInviteStatus('idle')
    }
  }

  return (
    <div>
      <PageHeader backTo={-1} title={household.name} subtitle="Household, tag and reminders" />

      <section className="fm-panel">
        <h2 className="fm-panel__head">
          <Icon name="home" />
          Join code
        </h2>
        <p className="fm-panel__body">Share this with anyone else who should see the same list.</p>
        <p className="fm-code" style={{ marginTop: '0.75rem' }}>
          {household.secret_code}
        </p>
      </section>

      <section className="fm-panel">
        <h2 className="fm-panel__head">
          <Icon name="share" />
          Invite by email
        </h2>
        <p className="fm-panel__body">Sends a link to set a password and join, with no code to read out.</p>
        <form onSubmit={handleInvite} className="fm-inline" style={{ marginTop: '0.75rem' }}>
          <input
            className="fm-field"
            type="email"
            placeholder="Their email address"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            aria-label="Email address to invite"
            required
          />
          <button type="submit" className="fm-btn" disabled={inviteStatus === 'sending'}>
            {inviteStatus === 'sending' ? 'Sending' : 'Send'}
          </button>
        </form>
        {inviteStatus === 'sent' && (
          <p className="fm-ok" style={{ marginTop: '0.75rem' }}>
            <Icon name="check" />
            Invite sent
          </p>
        )}
        {inviteError && (
          <p className="fm-error" style={{ marginTop: '0.75rem' }}>
            <Icon name="alert" />
            {inviteError}
          </p>
        )}
      </section>

      <section className="fm-panel">
        <h2 className="fm-panel__head">
          <Icon name="magnet" />
          Your fridge tag
        </h2>
        <p className="fm-panel__body">
          Write this address to an NFC sticker (NTAG213 or better) with a free app like NFC Tools, then
          stick it to the fridge. Tapping it moves everything you have ticked off into the right places.
        </p>
        <p className="fm-mono" style={{ marginTop: '0.75rem' }}>
          {syncUrl}
        </p>
        <button type="button" className="fm-btn fm-btn--secondary" style={{ marginTop: '0.75rem' }} onClick={handleCopy}>
          <Icon name={copied ? 'check' : 'copy'} />
          {copied ? 'Copied' : 'Copy address'}
        </button>
      </section>

      <section className="fm-panel">
        <h2 className="fm-panel__head">
          <Icon name="bell" />
          Reminders
        </h2>
        <p className="fm-panel__body">
          One notification a day, around 8am, if anything is about to go off. Never one per item.
        </p>

        {status === 'needs-install' && (
          <div style={{ marginTop: '0.75rem' }}>
            <InstallCard compact />
          </div>
        )}

        {status === 'needs-permission' && (
          <button type="button" className="fm-btn" style={{ marginTop: '0.75rem' }} onClick={subscribe}>
            Turn on reminders
          </button>
        )}

        {status === 'subscribed' && (
          <>
            <p className="fm-ok" style={{ marginTop: '0.75rem' }}>
              <Icon name="check" />
              Reminders are on for this phone
            </p>
            <button type="button" className="fm-btn fm-btn--secondary" style={{ marginTop: '0.75rem' }} onClick={unsubscribe}>
              Turn off
            </button>
          </>
        )}

        {STATUS_COPY[status] && <p className="fm-panel__body">{STATUS_COPY[status]}</p>}
        {error && (
          <p className="fm-error" style={{ marginTop: '0.75rem' }}>
            <Icon name="alert" />
            {error}
          </p>
        )}
      </section>

      <button type="button" className="fm-btn fm-btn--quiet fm-btn--block" style={{ marginTop: '1rem' }} onClick={signOut}>
        <Icon name="signOut" />
        Sign out
      </button>
    </div>
  )
}
