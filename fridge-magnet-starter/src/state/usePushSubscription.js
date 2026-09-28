import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { isStandalone } from '../lib/installPrompt'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// Web Push wants the application server key as raw bytes, but env vars
// and URLs only carry text — this is the standard base64url decode for it.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

// One status value drives the whole UI: what's stopping reminders right
// now, if anything, and what (if anything) a button here can fix.
export function usePushSubscription(householdId, userId) {
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)

  const checkStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
      setStatus('unsupported')
      return
    }
    if (!isStandalone()) {
      setStatus('needs-install')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    setStatus(existing ? 'subscribed' : 'needs-permission')
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const subscribe = useCallback(async () => {
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = subscription.toJSON()

      const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
        {
          household_id: householdId,
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
        },
        { onConflict: 'endpoint' }
      )
      if (upsertError) throw upsertError

      setStatus('subscribed')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [householdId, userId])

  const unsubscribe = useCallback(async () => {
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        await subscription.unsubscribe()
      }
      setStatus('needs-permission')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [])

  return { status, error, subscribe, unsubscribe }
}
