import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './state/AuthProvider.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ConfigError from './components/ConfigError.jsx'
import { isSupabaseConfigured } from './supabaseClient.js'
// Registers the beforeinstallprompt listener immediately — it fires once,
// early, and only if nothing later happens to be listening yet.
import './lib/installPrompt.js'

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
