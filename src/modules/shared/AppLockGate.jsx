import { useEffect, useState } from 'react'
import { Fingerprint, LockKeyhole, ShieldCheck, Unlock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getDeviceSecurity, isDeviceUnlocked, unlockWithBiometric, unlockWithPin, markDeviceUnlocked } from '../../services/deviceSecurityService'

export default function AppLockGate({ children }) {
  const { user } = useAuth()
  const [cfg, setCfg] = useState({ enabled:false, method:null })
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    setCfg(getDeviceSecurity(user.uid))
    setError('')
    setPin('')
  }, [user?.uid])

  if (!user?.uid || !cfg.enabled || isDeviceUnlocked(user.uid)) return children

  async function unlock() {
    setBusy(true); setError('')
    try {
      if (cfg.method === 'pin') await unlockWithPin(user.uid, pin)
      else await unlockWithBiometric(user.uid)
      setCfg(getDeviceSecurity(user.uid))
    } catch (e) { setError(e.message || 'Device verification failed.') }
    finally { setBusy(false) }
  }

  return <div className="min-h-[100dvh] bg-paper text-ink grid place-items-center p-5">
    <div className="w-full max-w-md rm-card p-6 sm:p-8 text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-brand/10 text-brand grid place-items-center"><LockKeyhole size={30}/></div>
      <p className="rm-kicker mt-5">Private device lock</p>
      <h1 className="font-display text-2xl font-extrabold mt-1">Unlock Rental Manager</h1>
      <p className="text-sm text-ink-soft mt-2">Your Firebase account is still signed in. This extra lock protects this device after refresh or relaunch.</p>
      {cfg.method === 'pin' ? <div className="mt-5 space-y-3"><input autoFocus inputMode="numeric" type="password" maxLength={8} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="Device PIN" className="w-full text-center tracking-[.5em] text-lg" aria-label="Device PIN"/><button onClick={unlock} disabled={busy || pin.length < 4} className="rm-hero-button w-full justify-center"><Unlock size={17}/>{busy?'Checking…':'Unlock'}</button></div> : <button onClick={unlock} disabled={busy} className="rm-hero-button w-full justify-center mt-5"><Fingerprint size={18}/>{busy?'Checking device…':'Use fingerprint / face'}</button>}
      {error && <p role="alert" className="mt-3 text-sm text-stamp-red">{error}</p>}
      <div className="mt-5 flex items-start gap-2 text-left rounded-xl bg-paper-raised p-3 text-xs text-ink-soft"><ShieldCheck size={16} className="text-brand shrink-0"/><span>Device lock is optional. For account-level protection, enable Authenticator-app MFA in Settings.</span></div>
    </div>
  </div>
}
