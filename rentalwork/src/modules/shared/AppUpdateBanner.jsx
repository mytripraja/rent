import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function AppUpdateBanner() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const onUpdate = () => setAvailable(true)
    window.addEventListener('rm:sw-update', onUpdate)
    return () => window.removeEventListener('rm:sw-update', onUpdate)
  }, [])
  if (!available) return null
  return <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[150] w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-brand/20 bg-paper-raised shadow-2xl p-3 flex items-center gap-3" role="status" aria-live="polite">
    <RefreshCw size={18} className="text-brand shrink-0" />
    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink">New Rental Manager update</p><p className="text-xs text-ink-soft mt-0.5">Refresh once to use the latest version.</p></div>
    <button className="rm-hero-button px-3 py-2 text-xs shrink-0" onClick={() => window.location.reload()}>Update</button>
    <button className="p-1.5 rounded-lg text-ink-soft hover:bg-paper" aria-label="Dismiss update" onClick={() => setAvailable(false)}><X size={16}/></button>
  </div>
}
