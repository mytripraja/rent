import { useEffect, useState } from 'react'
import { KeyRound, MailCheck, ShieldCheck, Fingerprint } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { sensitiveKeyAction } from '../../services/authService'
import { getDeviceSecurity, registerDeviceBiometric } from '../../services/deviceSecurityService'

export default function CriticalSecurityPanel() {
  const { user } = useAuth()
  const [configured, setConfigured] = useState(false)
  const [key, setKey] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [newKey, setNewKey] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)

  async function load() {
    try {
      const status = await sensitiveKeyAction('status')
      setConfigured(!!status.configured)
      setBiometricReady(getDeviceSecurity(user?.uid).method === 'biometric')
    } catch (e) { setError(e.message || 'Could not load security status.') }
  }
  useEffect(() => { if (user?.uid) load() }, [user?.uid])

  async function saveKey(e) {
    e.preventDefault(); setError(''); setMessage('')
    if (key.length < 8) return setError('Use at least 8 characters.')
    if (key !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try { await sensitiveKeyAction('set', { key }); setConfigured(true); setKey(''); setConfirm(''); setMessage('Critical change password saved.'); }
    catch (e) { setError(e.message || 'Could not save the password.') }
    finally { setBusy(false) }
  }

  async function requestReset() {
    setError(''); setMessage(''); setBusy(true)
    try { await sensitiveKeyAction('reset-request'); setResetting(true); setMessage('A reset code was sent to your account email.'); }
    catch (e) { setError(e.message || 'Could not send reset code.') }
    finally { setBusy(false) }
  }

  async function confirmReset(e) {
    e.preventDefault(); setError(''); setMessage('')
    if (newKey.length < 8) return setError('Use at least 8 characters.')
    setBusy(true)
    try { await sensitiveKeyAction('reset-confirm', { code, key:newKey }); setConfigured(true); setResetting(false); setCode(''); setNewKey(''); setMessage('Critical change password reset successfully.'); }
    catch (e) { setError(e.message || 'Could not reset the password.') }
    finally { setBusy(false) }
  }

  async function enableFace() {
    setBusy(true); setError(''); setMessage('')
    try { await registerDeviceBiometric(user.uid, user.name); setBiometricReady(true); setMessage('Face/fingerprint/device passkey verification is enabled on this device.') }
    catch (e) { setError(e.message || 'Could not enable device verification.') }
    finally { setBusy(false) }
  }

  return <section className="rounded-2xl border border-amber-300/40 bg-paper p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 grid place-items-center"><KeyRound size={18}/></span><div><h3 className="font-bold text-ink">Critical change security</h3><p className="text-xs text-ink-soft mt-1">Extra protection for correcting or reversing important rent records. This is separate from your normal sign-in password.</p></div></div>
    <form onSubmit={saveKey} className="mt-4 grid sm:grid-cols-2 gap-2">
      <input type="password" minLength={8} value={key} onChange={e=>setKey(e.target.value)} placeholder={configured ? 'New critical password' : 'Create critical password'} className="w-full" autoComplete="new-password"/>
      <input type="password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm critical password" className="w-full" autoComplete="new-password"/>
      <button disabled={busy || key.length < 8 || confirm.length < 8} className="sm:col-span-2 rounded-xl bg-brand text-white py-2.5 text-sm font-bold disabled:opacity-50">{configured ? 'Change critical password' : 'Set critical password'}</button>
    </form>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={requestReset} disabled={busy} className="rm-secondary-button text-xs"><MailCheck size={15}/> Forgot password — email me a reset code</button><button type="button" onClick={enableFace} disabled={busy} className="rm-secondary-button text-xs"><Fingerprint size={15}/>{biometricReady ? 'Face / fingerprint enabled' : 'Enable face / fingerprint'}</button></div>
    {resetting && <form onSubmit={confirmReset} className="mt-3 rounded-xl border border-brand/20 bg-brand/5 p-3 space-y-2"><p className="text-xs font-semibold text-ink">Enter the code sent to your email and choose a new password.</p><input inputMode="numeric" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit reset code" className="w-full"/><input type="password" minLength={8} value={newKey} onChange={e=>setNewKey(e.target.value)} placeholder="New critical password" className="w-full"/><button disabled={busy || code.length !== 6 || newKey.length < 8} className="w-full rounded-xl bg-brand text-white py-2.5 text-sm font-bold disabled:opacity-50">Reset password</button></form>}
    <p className="mt-3 text-[11px] text-ink-soft flex gap-2"><ShieldCheck size={14} className="shrink-0"/> The server stores only a salted password hash. Face/fingerprint verification uses the device platform authenticator; Rental Manager does not receive your biometric data.</p>
    {message && <p className="mt-3 text-sm text-brand" role="status">{message}</p>}{error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
  </section>
}
