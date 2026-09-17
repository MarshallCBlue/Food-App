import { useState } from 'react'
import { useInstallPrompt } from '../state/useInstallPrompt'
import InstallCard from './InstallCard'
import Icon from './Icon'

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
// permanently on the household screen for anyone who dismisses this and
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
    <div style={{ position: 'relative' }}>
      <InstallCard />
      <button
        type="button"
        className="fm-icon-btn"
        style={{ position: 'absolute', top: 0, right: 0, width: 36, height: 36 }}
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  )
}
