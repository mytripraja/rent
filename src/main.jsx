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
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      if (registration.waiting) window.dispatchEvent(new CustomEvent('rm:sw-update'))
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent('rm:sw-update'))
        })
      })
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'RM_SW_UPDATED') window.dispatchEvent(new CustomEvent('rm:sw-update'))
      })
    } catch {}
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
