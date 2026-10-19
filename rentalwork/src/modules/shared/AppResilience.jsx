import React, { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react'

export function OfflineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    const goOffline = () => { setOnline(false); setShowBackOnline(false) }
    const goOnline = () => { setOnline(true); setShowBackOnline(true); window.setTimeout(() => setShowBackOnline(false), 3500) }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline) }
  }, [])

  if (online && !showBackOnline) return null
  return <div className={`fixed left-1/2 -translate-x-1/2 bottom-[76px] sm:bottom-4 z-[120] rounded-2xl shadow-xl border px-4 py-3 flex items-center gap-3 text-sm font-semibold ${online ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`} role="status" aria-live="polite">
    {online ? <Wifi size={17}/> : <WifiOff size={17}/>}<span>{online ? 'Back online. Sync can continue.' : 'You are offline. Saved local data remains available; changes may sync when connection returns.'}</span>
  </div>
}

export function GlobalErrorBoundary({ children }) {
  // Kept as a functional wrapper so the app can render a lightweight recovery
  // surface without forcing a full browser reload after a render-time failure.
  // The actual error boundary is the class below.
  return <ErrorBoundary>{children}</ErrorBoundary>
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Rental Manager render error', error, info) }
  recover = () => { this.setState({ error: null }); window.dispatchEvent(new CustomEvent('rm:app-refresh')) }
  render() {
    if (!this.state.error) return this.props.children
    return <div className="min-h-screen bg-paper text-ink grid place-items-center p-6"><div className="rm-card max-w-md w-full p-6 text-center"><span className="mx-auto w-12 h-12 rounded-2xl bg-red-50 text-red-600 grid place-items-center"><AlertTriangle size={22}/></span><h1 className="font-display text-xl font-extrabold mt-4">Something went wrong</h1><p className="text-sm text-ink-soft mt-2">The page hit an unexpected error. Your saved account data has not been deleted.</p><button onClick={this.recover} className="rm-hero-button mt-5 mx-auto justify-center"><RefreshCw size={16}/> Try again</button></div></div>
  }
}
