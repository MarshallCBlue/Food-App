import { useEffect } from 'react'
import Icon from './Icon'

// A short message that slides in above the tabs — "that happened, and
// here is what you might want to do about it". It never blocks the
// screen, and it takes itself away.
//
// Buttons: either one (actionLabel + onAction), or several as
// actions = [{ label, onClick }], e.g. "Undo" and "Add to list".
export default function Toast({ message, actionLabel, onAction, actions, onDismiss, timeout = 8000 }) {
  useEffect(() => {
    if (!timeout) return undefined
    const timer = setTimeout(onDismiss, timeout)
    return () => clearTimeout(timer)
  }, [timeout, onDismiss])

  const buttons = actions || (actionLabel ? [{ label: actionLabel, onClick: onAction }] : [])

  return (
    <div className="fm-toast" role="status">
      <span className="fm-toast__text">{message}</span>
      {buttons.map((button) => (
        <button key={button.label} type="button" className="fm-toast__action" onClick={button.onClick}>
          {button.label}
        </button>
      ))}
      <button type="button" className="fm-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="close" />
      </button>
    </div>
  )
}
