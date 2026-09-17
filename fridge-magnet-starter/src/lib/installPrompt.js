// Chrome fires `beforeinstallprompt` once, early, and only if the app
// isn't already installed. It has to be captured immediately at module
// load — main.jsx imports this file first thing — rather than lazily
// inside whichever component happens to mount later, or the event (and
// the chance to show a custom "Install" button) is gone for good.
let deferredPrompt = null
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    listeners.forEach((listener) => listener(event))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener(null))
  })
}

export function getDeferredInstallPrompt() {
  return deferredPrompt
}

export function onInstallPromptChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

// True once the app is actually running as an installed app rather than
// a browser tab — this is the specific condition Step 9's notifications
// depend on for iPhone.
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function getPlatform() {
  const ua = window.navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}
