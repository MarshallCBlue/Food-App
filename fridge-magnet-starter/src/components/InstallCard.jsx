import { useInstallPrompt } from '../state/useInstallPrompt'
import { colors } from '../theme'

// Platform-specific "how to install" guidance — Android can trigger the
// browser's own install dialog directly; iOS Safari has no such API, so
// it's instructions only. Renders nothing once already installed, or on
// a platform where "add to home screen" isn't a meaningful concept.
export default function InstallCard({ compact = false }) {
  const { platform, standalone, canPromptInstall, promptInstall } = useInstallPrompt()

  if (standalone || platform === 'other') return null

  return (
    <div style={{ ...styles.card, ...(compact ? styles.compact : {}) }}>
      <p style={styles.heading}>Install Fridge Magnet</p>
      {platform === 'ios' && (
        <p style={styles.body}>
          Tap the Share button (
          <span aria-hidden="true">⬆️</span>) at the bottom of Safari, then "Add to Home
          Screen". This is also what turns on reminders (Step 9) — iPhone only sends
          notifications to apps installed this way, never to a page open in the browser.
        </p>
      )}
      {platform === 'android' && canPromptInstall && (
        <>
          <p style={styles.body}>
            Get your own icon, a proper app window, and reminders when something's about to go
            off.
          </p>
          <button type="button" style={styles.button} onClick={promptInstall}>
            Install app
          </button>
        </>
      )}
      {platform === 'android' && !canPromptInstall && (
        <p style={styles.body}>
          Open the browser menu (⋮) and choose "Install app" or "Add to Home screen".
        </p>
      )}
    </div>
  )
}

const styles = {
  card: {
    padding: '1rem',
    borderRadius: '0.75rem',
    background: colors.card,
    border: `1px solid ${colors.border}`,
    marginBottom: '1rem',
  },
  compact: {
    marginBottom: 0,
  },
  heading: {
    margin: '0 0 0.4rem 0',
    fontWeight: 600,
  },
  body: {
    margin: '0 0 0.6rem 0',
    fontSize: '0.9rem',
    color: colors.mutedText,
  },
  button: {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
