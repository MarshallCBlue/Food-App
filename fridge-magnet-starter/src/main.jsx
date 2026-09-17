import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// This is the very first code that runs. It finds the empty <div id="root">
// in index.html and tells React to draw the App component inside it.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
