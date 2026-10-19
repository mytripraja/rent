import { useEffect, useState } from 'react'
import { Fingerprint, LockKeyhole, Shield, ShieldOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { disableDeviceSecurity, getDeviceSecurity, registerDeviceBiometric, setDeviceSecurity, setPin } from '../../services/deviceSecurityService'

export default function DeviceSecurityPanel() {
  const { user } = useAuth()
  const [cfg, setCfg] = useState({ enabled:false, method:null })
  const [pin, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const supported = !!(window.PublicKeyCredential && navigator.credentials?.create)

  useEffect(() => { if (user?.uid) setCfg(getDeviceSecurity(user.uid)) }, [user?.uid])

  async function biometric() {
    setBusy(true); setError(''); setMessage('')
    try { await registerDeviceBiometric(user.uid, user.name); setCfg(getDeviceSecurity(user.uid)); setMessage('Fingerprint/face device unlock is enabled. Your biometric data stays with the device.') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  async function savePin() {
    setBusy(true); setError(''); setMessage('')
    try { if (pin !== confirm) throw new Error('PIN and confirmation do not match.'); await setPin(user.uid, pin); setCfg(getDeviceSecurity(user.uid)); setPinValue(''); setConfirm(''); setMessage('Device PIN lock is enabled.') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  function disable() { disableDeviceSecurity(user.uid); setCfg({enabled:false,method:null}); setMessage('Device lock is disabled. Your normal account sign-in remains active.') }

  return <section className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
    <div className="flex items-center gap-2"><span className="rm-feature-icon"><Shield size={17}/></span><div><h3 className="font-bold text-ink">Device unlock</h3><p className="text-xs text-ink-soft">Optional extra lock after the account is already signed in.</p></div></div>
    {cfg.enabled ? <div className="mt-4 rounded-xl bg-brand/5 border border-brand/20 p-3"><p className="text-sm font-bold text-brand">{cfg.method === 'pin' ? 'PIN lock enabled' : 'Fingerprint / face lock enabled'}</p><p className="text-xs text-ink-soft mt-1">It protects this device after refresh/relaunch. It does not replace Firebase account authentication.</p><button onClick={disable} className="rm-secondary-button mt-3"><ShieldOff size={15}/> Turn off device lock</button></div> : <div className="mt-4 space-y-4">
      {supported && <button onClick={biometric} disabled={busy} className="rm-hero-button w-full justify-center"><Fingerprint size={17}/>{busy?'Waiting for device…':'Use fingerprint / face / device passkey'}</button>}
      <div className="grid sm:grid-cols-2 gap-2"><input inputMode="numeric" type="password" maxLength={8} value={pin} onChange={e=>setPinValue(e.target.value.replace(/\D/g,''))} placeholder="4–8 digit PIN" className="w-full"/><input inputMode="numeric" type="password" maxLength={8} value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,''))} placeholder="Confirm PIN" className="w-full"/></div><button onClick={savePin} disabled={busy || pin.length < 4 || confirm.length < 4} className="rm-secondary-button w-full justify-center"><LockKeyhole size={16}/> Enable PIN lock</button>
    </div>}
    <p className="text-[11px] text-ink-soft mt-3">Fingerprint/face uses the browser's platform authenticator (WebAuthn/passkey). The website never receives or stores your fingerprint or face data.</p>
    {message && <p className="mt-3 text-sm text-brand" role="status">{message}</p>}{error && <p className="mt-3 text-sm text-stamp-red" role="alert">{error}</p>}
  </section>
}
