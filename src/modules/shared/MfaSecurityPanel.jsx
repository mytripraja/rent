import { useState } from 'react'
import { KeyRound, ShieldCheck, Copy, CheckCircle2 } from 'lucide-react'
import { EmailAuthProvider, TotpMultiFactorGenerator, multiFactor, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '../../services/firebase'

export default function MfaSecurityPanel() {
  const user = auth.currentUser
  const [password, setPassword] = useState('')
  const [secret, setSecret] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const enrolled = multiFactor(user).enrolledFactors?.some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)

  async function enroll() {
    if (!user) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (!password) throw new Error('Enter your current Rental Manager password to re-authenticate.')
      const credential = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, credential)
      const session = await multiFactor(user).getSession()
      const nextSecret = await TotpMultiFactorGenerator.generateSecret(session)
      setSecret(nextSecret)
      setMessage('Add this secret to Google Authenticator, Microsoft Authenticator, Authy or another TOTP app. Then enter the 6-digit code below.')
    } catch (e) {
      setError(e.code === 'auth/operation-not-allowed' ? 'TOTP MFA is not enabled in Firebase Authentication with Identity Platform yet.' : (e.message || 'Could not start authenticator setup.'))
    } finally { setBusy(false) }
  }

  async function finish() {
    if (!secret || !code.trim() || !user) return
    setBusy(true); setError('')
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim())
      await multiFactor(user).enroll(assertion, 'Authenticator app')
      setSecret(null); setCode(''); setPassword('')
      setMessage('Authenticator app MFA is now enabled for this account.')
    } catch (e) { setError(e.message || 'That authenticator code was not accepted.') }
    finally { setBusy(false) }
  }

  async function copySecret() {
    if (!secret?.secretKey) return
    await navigator.clipboard?.writeText(secret.secretKey)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return <section className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
    <div className="flex items-center gap-2"><span className="rm-feature-icon"><KeyRound size={17}/></span><div><h3 className="font-bold text-ink">Authenticator app</h3><p className="text-xs text-ink-soft">Optional two-step sign-in using a 6-digit code.</p></div></div>
    {enrolled ? <div className="mt-4 rounded-xl bg-brand/5 border border-brand/20 p-3 text-sm"><div className="flex gap-2 items-center font-semibold text-brand"><CheckCircle2 size={17}/> Authenticator MFA enabled</div><p className="text-xs text-ink-soft mt-1">Your sign-in will ask for a code from your authenticator app after your password.</p></div> : <>
      {!secret && <div className="mt-4 space-y-2"><label className="text-xs font-semibold text-ink">Current password</label><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter current password" className="w-full"/><button onClick={enroll} disabled={busy || !password} className="rm-hero-button w-full justify-center"><ShieldCheck size={16}/>{busy?'Preparing…':'Set up Authenticator app'}</button></div>}
      {secret && <div className="mt-4 space-y-3"><div className="rounded-xl bg-paper-raised border border-[var(--rm-border)] p-3"><p className="text-xs font-bold text-ink">Manual setup key</p><p className="font-mono text-lg tracking-widest mt-1 break-all select-all">{secret.secretKey}</p><button onClick={copySecret} className="rm-secondary-button mt-2"><Copy size={14}/>{copied?'Copied':'Copy key'}</button></div><p className="text-xs text-ink-soft">If your authenticator supports QR setup, use the setup URI below. Never share this key.</p><textarea readOnly value={secret.generateQrCodeUrl(user.email, 'Rental Manager')} className="w-full text-[11px] font-mono min-h-24" aria-label="Authenticator setup URI"/><input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="6-digit authenticator code" className="w-full text-center tracking-[.35em] text-lg"/><button onClick={finish} disabled={busy || code.length !== 6} className="rm-hero-button w-full justify-center">{busy?'Verifying…':'Verify and enable MFA'}</button></div>}
    </>}
    {message && <p role="status" className="mt-3 text-sm text-brand">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-stamp-red">{error}</p>}
  </section>
}
