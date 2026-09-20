import { useEffect, useState } from 'react'
import { Accessibility, Bell, CalendarDays, Eye, Mic, Settings, Volume2, X } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from './ui/NotificationBell'
import { updateOwnProfile } from '../../services/authService'
import { createGoogleCalendarLink } from '../../utils/calendarLinks'

const A11Y_KEY = 'rm_accessibility_preferences'

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(A11Y_KEY) || '{}') } catch { return {} }
}

function applyPrefs(prefs) {
  const root = document.documentElement
  root.classList.toggle('rm-a11y-large', !!prefs.largeText)
  root.classList.toggle('rm-a11y-contrast', !!prefs.highContrast)
  root.classList.toggle('rm-a11y-motion', !!prefs.reduceMotion)
}

export default function UserSettingsModal({ open, onClose }) {
  const { user, refreshUser } = useAuth()
  const { lang, setLang } = useLanguage()
  const [prefs, setPrefs] = useState(readPrefs)
  const [savingLang, setSavingLang] = useState(false)
  const [eventTitle, setEventTitle] = useState('Rent Manager reminder')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [eventTime, setEventTime] = useState('09:00')
  const [voiceMessage, setVoiceMessage] = useState('')

  useEffect(() => applyPrefs(prefs), [prefs])
  useEffect(() => {
    function onStorage() { setPrefs(readPrefs()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (!open) return null

  async function chooseLanguage(next) {
    setLang(next)
    setSavingLang(true)
    try {
      if (user?.uid) {
        await updateOwnProfile({ uid: user.uid, preferredLanguage: next })
        await refreshUser?.()
      }
      localStorage.setItem(`rm_language_selected_${user?.uid || 'guest'}`, next)
    } catch (e) {
      console.warn('Could not save language preference', e)
    } finally { setSavingLang(false) }
  }

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    localStorage.setItem(A11Y_KEY, JSON.stringify(next))
    applyPrefs(next)
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      setVoiceMessage('Voice reading is not supported by this browser.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'
    utterance.rate = .95
    window.speechSynthesis.speak(utterance)
    setVoiceMessage('Reading aloud…')
    utterance.onend = () => setVoiceMessage('Finished reading.')
  }

  const googleLink = createGoogleCalendarLink({ title: eventTitle, date: eventDate, time: eventTime, allDay: false })

  return <div className="fixed inset-0 z-[120] bg-black/50 p-3 sm:p-6 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rm-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3"><span className="rm-icon-button"><Settings size={19}/></span><div><p className="rm-kicker">Preferences</p><h2 id="settings-title" className="font-display text-2xl font-extrabold">Settings</h2><p className="text-sm text-ink-soft mt-1">Language, notifications, accessibility and integrations.</p></div></div>
        <button onClick={onClose} className="rm-icon-button" aria-label="Close settings"><X size={19}/></button>
      </div>

      <section className="mt-6 grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><Eye size={17}/></span><div><h3 className="font-bold text-ink">Language</h3><p className="text-xs text-ink-soft">Choose once; change it here any time.</p></div></div>
          <div className="mt-4 flex gap-2"><button disabled={savingLang} onClick={() => chooseLanguage('en')} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${lang === 'en' ? 'bg-brand text-white border-brand' : 'bg-paper-raised text-ink border-[var(--rm-border)]'}`}>English</button><button disabled={savingLang} onClick={() => chooseLanguage('ta')} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${lang === 'ta' ? 'bg-brand text-white border-brand' : 'bg-paper-raised text-ink border-[var(--rm-border)]'}`}>தமிழ்</button></div>
          <p className="text-[11px] text-ink-soft mt-3">This preference is saved to your account and used on future logins.</p>
        </div>

        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><Bell size={17}/></span><div><h3 className="font-bold text-ink">Notifications</h3><p className="text-xs text-ink-soft">The notification center now lives inside Settings.</p></div></div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-paper-raised border border-[var(--rm-border)] px-3 py-2"><span className="text-sm font-semibold">Notification center</span><NotificationBell userId={user?.uid} /></div>
          <p className="text-xs text-ink-soft mt-2">Browser notifications can still be enabled when the device supports them.</p>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
        <div className="flex items-center gap-2"><span className="rm-feature-icon"><Accessibility size={17}/></span><div><h3 className="font-bold text-ink">Accessibility</h3><p className="text-xs text-ink-soft">Designed for keyboard, screen-reader and low-vision users.</p></div></div>
        <div className="grid sm:grid-cols-3 gap-2 mt-4">
          <Toggle label="Larger text" checked={!!prefs.largeText} onChange={v => updatePref('largeText', v)} />
          <Toggle label="High contrast" checked={!!prefs.highContrast} onChange={v => updatePref('highContrast', v)} />
          <Toggle label="Reduce motion" checked={!!prefs.reduceMotion} onChange={v => updatePref('reduceMotion', v)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => speak(`Rental Manager. ${user?.name || ''}. Accessibility settings are available here.`)} className="rm-secondary-button"><Volume2 size={16}/> Read this page aloud</button><span className="text-xs text-ink-soft self-center">{voiceMessage || 'Voice reading uses your browser speech engine.'}</span></div>
      </section>

      <section className="mt-3 grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><CalendarDays size={17}/></span><div><h3 className="font-bold text-ink">Google Calendar</h3><p className="text-xs text-ink-soft">Quickly add Rental Manager events to Google Calendar.</p></div></div>
          <input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className="mt-4 w-full" placeholder="Event title" aria-label="Calendar event title"/>
          <div className="grid grid-cols-2 gap-2 mt-2"><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} aria-label="Event date"/><input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} aria-label="Event time"/></div>
          <a href={googleLink} target="_blank" rel="noreferrer" className="rm-hero-button mt-3 w-full"><CalendarDays size={16}/> Add to Google Calendar</a>
          <p className="text-[11px] text-ink-soft mt-2">Two-way automatic sync requires Google OAuth credentials and Calendar API access; this button needs no extra permission.</p>
        </div>

        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><Mic size={17}/></span><div><h3 className="font-bold text-ink">Voice access</h3><p className="text-xs text-ink-soft">Voice-friendly controls are available for blind and low-vision users.</p></div></div>
          <ul className="mt-3 space-y-2 text-xs text-ink-soft leading-5"><li>• Browser voice reading uses the device's speech engine.</li><li>• Google Assistant on Android can launch supported app actions when the Android app is configured.</li><li>• Alexa requires a published custom skill and account linking before it can securely access tenant data.</li></ul>
          <div className="mt-3 rounded-xl bg-paper-raised border border-[var(--rm-border)] p-3 text-xs text-ink-soft">For privacy, voice integrations should never expose rent, bills or tenant information without account authentication.</div>
        </div>
      </section>

      <button onClick={onClose} className="w-full mt-5 rounded-xl bg-cover text-white py-3 font-bold">Done</button>
    </div>
  </div>
}

function Toggle({ label, checked, onChange }) {
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--rm-border)] bg-paper-raised px-3 py-3 cursor-pointer"><span className="text-sm font-semibold text-ink">{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} aria-label={label}/></label>
}
