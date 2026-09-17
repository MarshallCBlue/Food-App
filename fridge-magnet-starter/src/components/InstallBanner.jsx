import { useState } from 'react'
import { useInstallPrompt } from '../state/useInstallPrompt'
import InstallCard from './InstallCard'
import { colors } from '../theme'

const DISMISSED_KEY = 'fridge-magnet:install-banner-dismissed'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

// The install nudge shown across the top of the app until either it's
// installed or someone dismisses it. The same instructions live
// permanently on the Household screen for anyone who dismisses this and
// changes their mind later.
export default function InstallBanner() {
  const { standalone, platform } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(wasDismissed)

  if (standalone || platform === 'other' || dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // Private browsing or blocked storage — the banner just won't stay
      // dismissed across a reload, which is a minor inconvenience, not a
      // reason to break the button.
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.content}>
        <InstallCard compact />
      </div>
      <button type="button" style={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem 0',
  },
  content: {
    flex: 1,
  },
  dismiss: {
    border: 'none',
    background: 'none',
    color: colors.mutedText,
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0.9rem 0 0 0',
  },
}
