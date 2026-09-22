import { useEffect, useRef, useState } from 'react'
import { Accessibility, Bell, CalendarDays, Eye, Keyboard, Mic, Pause, Play, Settings, ShieldCheck, Volume2, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from './ui/NotificationBell'
import { updateOwnProfile } from '../../services/authService'
import { createGoogleCalendarLink } from '../../utils/calendarLinks'
import DeviceSecurityPanel from './DeviceSecurityPanel'
import MfaSecurityPanel from './MfaSecurityPanel'
import { requestNotificationPermission } from '../../services/pushService'

const A11Y_KEY = 'rm_accessibility_preferences'
const NOTIF_KEY = 'rm_notification_preferences_v1'

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(A11Y_KEY) || '{}') } catch { return {} }
}

function applyPrefs(prefs) {
  const root = document.documentElement
  root.classList.toggle('rm-a11y-large', !!prefs.largeText)
  root.classList.toggle('rm-a11y-contrast', !!prefs.highContrast)
  root.classList.toggle('rm-a11y-motion', !!prefs.reduceMotion)
  root.classList.toggle('rm-a11y-focus', prefs.strongFocus !== false)
}

export default function UserSettingsModal({ open, onClose }) {
  const { user, refreshUser } = useAuth()
  const { lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [prefs, setPrefs] = useState(readPrefs)
  const [savingLang, setSavingLang] = useState(false)
  const [eventTitle, setEventTitle] = useState('Rent Manager reminder')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [eventTime, setEventTime] = useState('09:00')
  const [voiceMessage, setVoiceMessage] = useState('Voice controls are ready.')
  const [listening, setListening] = useState(false)
  const [reading, setReading] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState(() => { try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{"inApp":true,"browser":true,"rent":true,"messages":true,"maintenance":true,"general":true}') } catch { return { inApp:true,browser:true,rent:true,messages:true,maintenance:true,general:true } } })
  const recognitionRef = useRef(null)
  const speechRef = useRef(null)

  useEffect(() => applyPrefs(prefs), [prefs])
  useEffect(() => {
    function onStorage() { setPrefs(readPrefs()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => () => {
    recognitionRef.current?.stop?.()
    window.speechSynthesis?.cancel?.()
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

  function updateNotif(key, value) { const next={...notifPrefs,[key]:value}; setNotifPrefs(next); localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); if(key==='browser' && value) requestNotificationPermission() }

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    localStorage.setItem(A11Y_KEY, JSON.stringify(next))
    applyPrefs(next)
  }

  function stopReading() {
    window.speechSynthesis?.cancel?.()
    setReading(false)
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      setVoiceMessage('Voice reading is not supported by this browser.')
      return
    }
    stopReading()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'
    utterance.rate = .92
    utterance.pitch = 1
    speechRef.current = utterance
    utterance.onstart = () => setReading(true)
    utterance.onend = () => { setReading(false); setVoiceMessage('Finished reading.') }
    utterance.onerror = () => { setReading(false); setVoiceMessage('Voice reading stopped.') }
    window.speechSynthesis.speak(utterance)
    setVoiceMessage('Reading aloud…')
  }

  function readCurrentPage() {
    const main = document.getElementById('main-content')
    const text = main?.innerText?.replace(/\s+/g, ' ').trim()
    speak(text || 'Rental Manager. No readable page content was found.')
  }

  function navigateByVoice(command) {
    const c = command.toLowerCase().trim()
    const owner = user?.role === 'owner' || user?.role === 'admin'
    const rules = owner ? [
      [['home', 'dashboard', 'overview', 'முகப்பு'], '/owner/home'],
      [['houses', 'house', 'வீடு', 'வீடுகள்'], '/owner/houses'],
      [['tenants', 'tenant', 'resident', 'குடியிருப்போர்'], '/owner/tenants'],
      [['approvals', 'rent approval'], '/owner/approvals'],
      [['calendar', 'payment calendar', 'காலண்டர்'], '/owner/calendar'],
      [['complaints', 'complaint', 'புகார்'], '/owner/complaints'],
      [['reports', 'report', 'அறிக்கைகள்'], '/owner/reports'],
      [['more', 'settings', 'more tools', 'மேலும்'], '/owner/more'],
    ] : [
      [['home', 'dashboard', 'overview', 'முகப்பு'], '/tenant'],
      [['rent', 'rent payment', 'வாடகை'], '/tenant#tenant-rent'],
      [['bills', 'bill', 'utility', 'பில்', 'பில்கள்'], '/tenant#tenant-bills'],
      [['calendar', 'காலண்டர்'], '/tenant#tenant-calendar'],
      [['blueprint', 'floor plan', 'வரைபடம்'], '/tenant#tenant-blueprint'],
      [['news', 'செய்திகள்'], '/tenant#tenant-news'],
      [['more', 'மேலும்'], '/tenant#tenant-more'],
    ]
    if (c.includes('read page') || c.includes('read this page') || c.includes('பக்கத்தை படி')) return readCurrentPage()
    if (c.includes('stop reading') || c.includes('stop voice') || c.includes('பேச்சை நிறுத்து')) return stopReading()
    for (const [phrases, target] of rules) {
      if (phrases.some(p => c === p || c.includes(p))) {
        if (target.includes('#')) {
          const [path, hash] = target.split('#')
          if (location.pathname === path) document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          else navigate(path + `#${hash}`)
        } else navigate(target)
        setVoiceMessage(`Opened ${target.replace('/owner/','').replace('/tenant','Home').replaceAll('-', ' ')}.`)
        return
      }
    }
    if (c.includes('larger text') || c.includes('increase text') || c.includes('பெரிய எழுத்து')) {
      updatePref('largeText', true); setVoiceMessage('Larger text enabled.'); return
    }
    if (c.includes('high contrast') || c.includes('அதிக மாறுபாடு')) {
      updatePref('highContrast', true); setVoiceMessage('High contrast enabled.'); return
    }
    setVoiceMessage('I did not recognise that command. Try “open rent”, “open calendar”, or “read this page”.')
  }

  function toggleVoiceControl() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceMessage('Voice control is not supported by this browser. Use Microsoft Edge or Google Chrome on a supported device.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop?.()
      setListening(false)
      setVoiceMessage('Voice control stopped.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = lang === 'ta' ? 'ta-IN' : 'en-IN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => { setListening(true); setVoiceMessage('Listening… say a command.') }
    recognition.onresult = event => {
      const command = event.results?.[0]?.[0]?.transcript || ''
      setVoiceMessage(`Heard: “${command}”`)
      navigateByVoice(command)
    }
    recognition.onerror = event => { setListening(false); setVoiceMessage(`Voice control error: ${event.error || 'unknown error'}.`) }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
  }

  const googleLink = createGoogleCalendarLink({ title: eventTitle, date: eventDate, time: eventTime, allDay: false })
  const dialogText = 'Rental Manager accessibility and voice settings.'

  return <div className="fixed inset-0 z-[120] bg-black/60 p-2 sm:p-6 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-describedby="settings-description">
    <div id="settings-dialog" className="w-full max-w-4xl max-h-[94dvh] overflow-y-auto rm-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 sticky top-0 bg-paper-raised/95 backdrop-blur-md pb-3 z-10">
        <div className="flex items-center gap-3"><span className="rm-icon-button" aria-hidden="true"><Settings size={19}/></span><div><p className="rm-kicker">Preferences & accessibility</p><h2 id="settings-title" className="font-display text-2xl font-extrabold">Settings</h2><p id="settings-description" className="text-sm text-ink-soft mt-1">{dialogText} Choose visual, reading and voice controls without needing a mouse.</p></div></div>
        <button onClick={onClose} className="rm-icon-button" aria-label="Close settings"><X size={19}/></button>
      </div>

      <section className="mt-4 grid lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><Eye size={17}/></span><div><h3 className="font-bold text-ink">Language</h3><p className="text-xs text-ink-soft">Choose English or Tamil.</p></div></div>
          <div className="mt-4 flex gap-2"><button disabled={savingLang} onClick={() => chooseLanguage('en')} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${lang === 'en' ? 'bg-brand text-white border-brand' : 'bg-paper-raised text-ink border-[var(--rm-border)]'}`} aria-pressed={lang === 'en'}>English</button><button disabled={savingLang} onClick={() => chooseLanguage('ta')} className={`flex-1 rounded-xl py-3 text-sm font-bold border ${lang === 'ta' ? 'bg-brand text-white border-brand' : 'bg-paper-raised text-ink border-[var(--rm-border)]'}`} aria-pressed={lang === 'ta'}>தமிழ்</button></div>
          <p className="text-[11px] text-ink-soft mt-3">Saved to your account and used on future logins.</p>
        </div>

        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><Bell size={17}/></span><div><h3 className="font-bold text-ink">Notifications</h3><p className="text-xs text-ink-soft">Manage your notification center.</p></div></div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-paper-raised border border-[var(--rm-border)] px-3 py-2"><span className="text-sm font-semibold">Notification center</span><NotificationBell userId={user?.uid} /></div>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--rm-border)] bg-paper p-4" aria-labelledby="notification-preferences-heading">
        <div className="flex items-center gap-2"><span className="rm-feature-icon"><Bell size={17}/></span><div><h3 id="notification-preferences-heading" className="font-bold text-ink">Notification preferences</h3><p className="text-xs text-ink-soft">Choose which normal app notifications you want. Admin-controlled rent reminders still follow the property's schedule.</p></div></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
          <Toggle label="In-app notifications" description="Show messages in Notification Center" checked={notifPrefs.inApp} onChange={v=>updateNotif('inApp',v)} />
          <Toggle label="Browser notifications" description="Allow device notifications" checked={notifPrefs.browser} onChange={v=>updateNotif('browser',v)} />
          <Toggle label="Rent reminders" description="Due/unpaid rent alerts" checked={notifPrefs.rent} onChange={v=>updateNotif('rent',v)} />
          <Toggle label="Messages" description="Notices and received messages" checked={notifPrefs.messages} onChange={v=>updateNotif('messages',v)} />
          <Toggle label="Maintenance" description="Repair and complaint updates" checked={notifPrefs.maintenance} onChange={v=>updateNotif('maintenance',v)} />
          <Toggle label="Other basics" description="Bookings, bills and general alerts" checked={notifPrefs.general} onChange={v=>updateNotif('general',v)} />
        </div>
      </section>

      <section className="mt-3 grid lg:grid-cols-2 gap-3">
        <DeviceSecurityPanel />
        <MfaSecurityPanel />
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--rm-border)] bg-paper p-4" aria-labelledby="accessibility-heading">
        <div className="flex items-center gap-2"><span className="rm-feature-icon"><Accessibility size={17}/></span><div><h3 id="accessibility-heading" className="font-bold text-ink">Accessibility</h3><p className="text-xs text-ink-soft">Controls for low vision, blind users, motor access and motion sensitivity.</p></div></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          <Toggle label="Larger text" description="Increase readable text" checked={!!prefs.largeText} onChange={v => updatePref('largeText', v)} />
          <Toggle label="High contrast" description="Stronger borders and separation" checked={!!prefs.highContrast} onChange={v => updatePref('highContrast', v)} />
          <Toggle label="Reduce motion" description="Limit animations" checked={!!prefs.reduceMotion} onChange={v => updatePref('reduceMotion', v)} />
          <Toggle label="Strong focus" description="Bright keyboard focus outline" checked={prefs.strongFocus !== false} onChange={v => updatePref('strongFocus', v)} />
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          <button onClick={readCurrentPage} className="rm-secondary-button justify-center" aria-label="Read the current page aloud"><Volume2 size={16}/> {reading ? 'Reading page…' : 'Read current page aloud'}</button>
          <div className="flex gap-2"><button onClick={() => speak('Rental Manager. You are in Accessibility Settings. Use Tab to move between controls and Enter or Space to activate a focused control.')} className="rm-secondary-button flex-1 justify-center"><Play size={15}/> Read help</button><button onClick={stopReading} className="rm-secondary-button" aria-label="Stop voice reading"><Pause size={15}/></button></div>
        </div>
        <div className="mt-3 rounded-xl bg-paper-raised border border-[var(--rm-border)] p-3 text-xs text-ink-soft" aria-live="polite">{voiceMessage}</div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--rm-border)] bg-paper p-4" aria-labelledby="voice-heading">
        <div className="flex items-center gap-2"><span className="rm-feature-icon"><Mic size={17}/></span><div><h3 id="voice-heading" className="font-bold text-ink">Voice Assistant</h3><p className="text-xs text-ink-soft">Voice control is separated from text-to-speech so blind and low-vision users can navigate the app hands-free.</p></div></div>
        <div className="mt-4 grid lg:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Browser voice control</p>
            <p className="text-sm font-bold mt-1">{listening ? 'Listening for one command' : 'Ready'}</p>
            <p className="text-xs text-ink-soft mt-2">Try “open rent”, “open calendar”, “open houses”, “read this page”, or “stop reading”.</p>
            <button onClick={toggleVoiceControl} className="rm-hero-button w-full mt-3 justify-center" aria-pressed={listening}><Mic size={16}/> {listening ? 'Stop listening' : 'Start voice control'}</button>
          </div>
          <div className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Google Assistant</p>
            <p className="text-sm font-bold mt-1">Android account linking</p>
            <p className="text-xs text-ink-soft mt-2">A real Google Assistant connection requires an Android app and an OAuth 2.0 account-linking service. This button opens the official setup documentation rather than pretending the account is linked.</p>
            {import.meta.env.VITE_GOOGLE_VOICE_LINK_URL ? <a className="rm-hero-button w-full mt-3 justify-center" href={import.meta.env.VITE_GOOGLE_VOICE_LINK_URL} target="_blank" rel="noreferrer">Connect Google Assistant</a> : <a className="rm-secondary-button w-full mt-3 justify-center" href="https://developers.google.com/assistant/identity/link-with-google" target="_blank" rel="noreferrer">Setup Google linking</a>}
          </div>
          <div className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Alexa</p>
            <p className="text-sm font-bold mt-1">Secure account linking</p>
            <p className="text-xs text-ink-soft mt-2">Alexa requires a published skill and OAuth 2.0 account linking before it can read private rent or tenant data.</p>
            {import.meta.env.VITE_ALEXA_LINK_URL ? <a className="rm-hero-button w-full mt-3 justify-center" href={import.meta.env.VITE_ALEXA_LINK_URL} target="_blank" rel="noreferrer">Connect Alexa</a> : <a className="rm-secondary-button w-full mt-3 justify-center" href="https://developer.amazon.com/docs/alexaplus/account-linking/steps-to-implement-account-linking.html" target="_blank" rel="noreferrer">Setup Alexa linking</a>}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs text-ink-soft"><ShieldCheck size={16} className="text-brand mt-0.5 shrink-0"/><span>Voice actions must use the signed-in Firebase identity and the same tenant permissions as the normal UI. Never expose rent, bills, payment or tenant information to an unlinked voice account.</span></div>
      </section>

      <section className="mt-3 grid lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><Keyboard size={17}/></span><div><h3 className="font-bold text-ink">Keyboard & screen-reader help</h3><p className="text-xs text-ink-soft">Everything important can be reached without a mouse.</p></div></div>
          <ul className="mt-3 space-y-2 text-xs text-ink-soft leading-5"><li><strong className="text-ink">Tab / Shift + Tab:</strong> move through controls.</li><li><strong className="text-ink">Enter / Space:</strong> activate buttons and switches.</li><li><strong className="text-ink">Escape:</strong> close dialogs when supported.</li><li><strong className="text-ink">Skip to main content:</strong> available at the top of each page.</li></ul>
        </div>
        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
          <div className="flex items-center gap-2"><span className="rm-feature-icon"><CalendarDays size={17}/></span><div><h3 className="font-bold text-ink">Google Calendar</h3><p className="text-xs text-ink-soft">Add a reminder to your Google Calendar.</p></div></div>
          <input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className="mt-4 w-full" placeholder="Event title" aria-label="Calendar event title"/>
          <div className="grid grid-cols-2 gap-2 mt-2"><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} aria-label="Event date"/><input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} aria-label="Event time"/></div>
          <a href={googleLink} target="_blank" rel="noreferrer" className="rm-hero-button mt-3 w-full justify-center"><CalendarDays size={16}/> Add to Google Calendar</a>
          <p className="text-[11px] text-ink-soft mt-2">This is a one-way calendar event link. Full two-way sync needs Google OAuth + Calendar API.</p>
        </div>
      </section>

      <button onClick={onClose} className="w-full mt-5 rounded-xl bg-cover text-white py-3 font-bold" aria-label="Close Settings">Done</button>
    </div>
  </div>
}

function Toggle({ label, description, checked, onChange }) {
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--rm-border)] bg-paper-raised px-3 py-3 cursor-pointer"><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{label}</span><span className="block text-[11px] text-ink-soft mt-0.5">{description}</span></span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} aria-label={`${label}: ${checked ? 'on' : 'off'}`} /></label>
}
