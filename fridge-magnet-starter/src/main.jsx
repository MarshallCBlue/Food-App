import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
// The whole look of the app lives in this one stylesheet.
import './styles.css'
import { AuthProvider } from './state/AuthProvider.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ConfigError from './components/ConfigError.jsx'
import { isSupabaseConfigured } from './supabaseClient.js'
// Registers the beforeinstallprompt listener immediately — it fires once,
// early, and only if nothing later happens to be listening yet.
import './lib/installPrompt.js'

// Keeping the installed app up to date. The service worker (src/sw.js)
// stores a copy of the app on the phone so it opens instantly, but that
// copy used to hang around until the app was fully closed — so a new
// release could sit unseen for days. Two fixes:
//  - each time the app comes back on screen, ask Netlify if there is a
//    newer version (the browser only checks by itself on a fresh launch);
//  - when a newer version takes over, reload once so it is actually shown.
// The very first install is skipped, since nothing old is on screen then.
if ('serviceWorker' in navigator) {
  const hadOldVersion = Boolean(navigator.serviceWorker.controller)
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadOldVersion || reloading) return
    reloading = true
    window.location.reload()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    navigator.serviceWorker.getRegistration().then((registration) => registration?.update())
  })
}

// This is the very first code that runs. It finds the empty <div id="root">
// in index.html and tells React to draw something inside it — either the
// real app (wired up to the browser's address bar via BrowserRouter, and
// to who's signed in via AuthProvider), or a plain-English error screen if
// the Supabase settings never made it into this build. Either way,
// ErrorBoundary means an unexpected crash shows its message instead of
// leaving the page blank.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isSupabaseConfigured ? (
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      ) : (
        <ConfigError />
      )}
    </ErrorBoundary>
  </React.StrictMode>
)
