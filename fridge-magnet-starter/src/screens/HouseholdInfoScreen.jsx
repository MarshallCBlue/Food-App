import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { colors } from '../theme'

// Where the household's join code and its NFC tag address live — the one
// thing you need in hand before you can write the tag with NFC Tools.
export default function HouseholdInfoScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

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

  return (
    <div style={{ paddingTop: '1rem' }}>
      <div style={styles.header}>
        <button type="button" style={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 style={styles.title}>{household.name}</h2>
      </div>

      <section style={styles.card}>
        <h3 style={styles.cardHeading}>Join code</h3>
        <p style={styles.body}>Share this with anyone else who should see the same list:</p>
        <p style={styles.code}>{household.secret_code}</p>
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardHeading}>Your fridge tag</h3>
        <p style={styles.body}>
          Write this address to an NFC sticker (NTAG213 or better) with a free app like NFC
          Tools, then stick it to the fridge. Tapping it will move everything you've ticked off
          into the right cupboards.
        </p>
        <p style={styles.url}>{syncUrl}</p>
        <button type="button" style={styles.copyButton} onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy address'}
        </button>
      </section>
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  backButton: {
    border: 'none',
    background: 'none',
    color: colors.primary,
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
  },
  card: {
    padding: '1rem',
    borderRadius: '0.75rem',
    background: colors.card,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '1rem',
  },
  cardHeading: {
    margin: '0 0 0.5rem 0',
    fontSize: '1rem',
  },
  body: {
    color: colors.mutedText,
    margin: '0 0 0.5rem 0',
    fontSize: '0.9rem',
  },
  code: {
    fontSize: '1.8rem',
    fontWeight: 700,
    letterSpacing: '0.2em',
    margin: 0,
    color: colors.primary,
  },
  url: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    wordBreak: 'break-all',
    background: colors.background,
    padding: '0.6rem',
    borderRadius: '0.4rem',
    margin: '0 0 0.75rem 0',
  },
  copyButton: {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
