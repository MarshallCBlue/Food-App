import { useCallback, useState } from 'react'
import Toast from './Toast'

// For taps that save something in the background (ticking an item,
// renaming an aisle, deleting a recipe). Before this, a failed save just
// did nothing, so it looked as if the app had ignored you.
//
// Usage:
//   const [attempt, errorToast] = useErrorToast()
//   attempt(() => renameCategory(id, name))
//   ...and put {errorToast} somewhere in the screen.
//
// attempt() returns whatever the action returns, or undefined if it
// failed (in which case the message has already been shown).
export function useErrorToast() {
  const [message, setMessage] = useState(null)
  const dismiss = useCallback(() => setMessage(null), [])

  const attempt = useCallback(async (action) => {
    try {
      return await action()
    } catch (err) {
      setMessage(friendlyError(err))
      return undefined
    }
  }, [])

  const toast = message ? <Toast message={message} onDismiss={dismiss} timeout={7000} /> : null
  return [attempt, toast]
}

// Turns the database's wording into something a person can act on.
export function friendlyError(err) {
  const text = err?.message || String(err)
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(text)) {
    return "Couldn't reach the server, so that didn't save. Check your connection and try again."
  }
  return `That didn't save: ${text}`
}
