import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

export default function InstallAppPrompt() {
  const [event, setEvent] = useState(null)
  const [hidden, setHidden] = useState(() => localStorage.getItem('rm_install_prompt_hidden') === '1')

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setEvent(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!event || hidden) return null

  async function install() {
    await event.prompt()
    setEvent(null)
  }

  function dismiss() {
    localStorage.setItem('rm_install_prompt_hidden', '1')
    setHidden(true)
  }

  return (
    <div className="fixed left-3 right-3 bottom-[78px] lg:bottom-4 z-[80] max-w-md lg:left-auto lg:right-5 rounded-2xl border border-[var(--rm-border)] bg-paper-raised shadow-2xl p-3.5 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0"><Smartphone size={19}/></div>
      <div className="flex-1 min-w-0"><p className="text-sm font-bold text-ink">Install Rental Manager</p><p className="text-xs text-ink-soft mt-0.5">Use it like an app with faster return and offline shell.</p></div>
      <button onClick={install} className="inline-flex items-center gap-1.5 rounded-xl bg-brand text-white px-3 py-2 text-xs font-bold"><Download size={14}/> Install</button>
      <button onClick={dismiss} className="w-8 h-8 rounded-lg text-ink-soft flex items-center justify-center" aria-label="Dismiss"><X size={16}/></button>
    </div>
  )
}
