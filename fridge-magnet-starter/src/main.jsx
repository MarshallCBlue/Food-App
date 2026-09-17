import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './state/AuthProvider.jsx'

// This is the very first code that runs. It finds the empty <div id="root">
// in index.html and tells React to draw the App component inside it, wired
// up to the browser's address bar (BrowserRouter) and to who's signed in
// (AuthProvider).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
