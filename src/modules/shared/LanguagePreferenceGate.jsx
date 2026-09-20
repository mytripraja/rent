import { useEffect, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { updateOwnProfile } from '../../services/authService'

export default function LanguagePreferenceGate() {
  const { user, refreshUser } = useAuth()
  const { setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    const key = `rm_language_selected_${user.uid}`
    if (user.preferredLanguage === 'en' || user.preferredLanguage === 'ta' || localStorage.getItem(key)) return
    setOpen(true)
  }, [user?.uid, user?.preferredLanguage])

  if (!open) return null

  async function select(next) {
    setSaving(true)
    setLang(next)
    try {
      await updateOwnProfile({ uid: user.uid, preferredLanguage: next })
      localStorage.setItem(`rm_language_selected_${user.uid}`, next)
      await refreshUser?.()
      setOpen(false)
    } catch (e) {
      console.warn(e)
      localStorage.setItem(`rm_language_selected_${user.uid}`, next)
      setOpen(false)
    } finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-[130] bg-black/55 p-4 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="language-title">
    <div className="w-full max-w-md rm-card p-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-brand/10 text-brand grid place-items-center"><Globe2 size={27}/></div>
      <p className="rm-kicker mt-5">First-time setup</p>
      <h2 id="language-title" className="font-display text-2xl font-extrabold mt-1">Choose your language</h2>
      <p className="text-sm text-ink-soft mt-2 leading-6">We will use this choice throughout Rental Manager. You can change it later from Settings.</p>
      <div className="grid grid-cols-2 gap-3 mt-6"><button disabled={saving} onClick={()=>select('en')} className="rounded-2xl border border-[var(--rm-border-strong)] bg-paper-raised py-4 font-bold text-ink hover:border-brand">English</button><button disabled={saving} onClick={()=>select('ta')} className="rounded-2xl border border-[var(--rm-border-strong)] bg-paper-raised py-4 font-bold text-ink hover:border-brand">தமிழ்</button></div>
      <p className="text-[11px] text-ink-soft mt-4">Settings → Language lets you change this later.</p>
    </div>
  </div>
}
