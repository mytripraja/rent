import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

try {
  const prefs = JSON.parse(localStorage.getItem('rm_accessibility_preferences') || '{}')
  document.documentElement.classList.toggle('rm-a11y-large', !!prefs.largeText)
  document.documentElement.classList.toggle('rm-a11y-contrast', !!prefs.highContrast)
  document.documentElement.classList.toggle('rm-a11y-motion', !!prefs.reduceMotion)
} catch {}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
