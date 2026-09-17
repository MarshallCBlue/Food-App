import { useEffect } from 'react'
import Icon from './Icon'

// A short message that slides in above the tabs — "that happened, and
// here is the one thing you might want to do about it". It never blocks
// the screen, and it takes itself away.
export default function Toast({ message, actionLabel, onAction, onDismiss, timeout = 8000 }) {
  useEffect(() => {
    if (!timeout) return undefined
    const timer = setTimeout(onDismiss, timeout)
    return () => clearTimeout(timer)
  }, [timeout, onDismiss])

  return (
    <div className="fm-toast" role="status">
      <span className="fm-toast__text">{message}</span>
      {actionLabel && (
        <button type="button" className="fm-toast__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button type="button" className="fm-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="close" />
      </button>
    </div>
  )
}
