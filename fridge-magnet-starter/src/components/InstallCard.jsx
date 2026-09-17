import { useInstallPrompt } from '../state/useInstallPrompt'
import Icon from './Icon'

// Platform-specific "how to install" guidance — Android can trigger the
// browser's own install dialog directly; iOS Safari has no such API, so
// it's instructions only. Renders nothing once already installed, or on
// a platform where "add to home screen" isn't a meaningful concept.
export default function InstallCard({ compact = false }) {
  const { platform, standalone, canPromptInstall, promptInstall } = useInstallPrompt()

  if (standalone || platform === 'other') return null

  return (
    <div className="fm-install" style={compact ? { margin: 0 } : undefined}>
      <span className="fm-install__icon">
        <Icon name="install" />
      </span>
      <div className="fm-install__text">
        <p className="fm-install__title">Add Fridge Magnet to your home screen</p>

        {platform === 'ios' && (
          <p className="fm-install__body">
            Tap Share at the bottom of Safari, then "Add to Home Screen". This is also what turns
            reminders on: an iPhone only sends notifications to apps installed this way.
          </p>
        )}

        {platform === 'android' && canPromptInstall && (
          <>
            <p className="fm-install__body">
              Your own icon, a proper app window, and a nudge when something is about to go off.
            </p>
            <button type="button" className="fm-btn fm-btn--sm" style={{ marginTop: '0.5rem' }} onClick={promptInstall}>
              Install app
            </button>
          </>
        )}

        {platform === 'android' && !canPromptInstall && (
          <p className="fm-install__body">
            Open the browser menu and choose "Install app" or "Add to Home screen".
          </p>
        )}
      </div>
    </div>
  )
}
