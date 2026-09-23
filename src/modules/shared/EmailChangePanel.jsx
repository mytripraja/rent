import { useState } from 'react'
import { CheckCircle2, Mail, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { auth } from '../../services/firebase'
import { requestEmailChange, verifyEmailChange } from '../../services/emailChangeService'

export default function EmailChangePanel() {
  const { user, refreshUser } = useAuth()
  const [newEmail, setNewEmail] = useState('')
  const [oldUnavailable, setOldUnavailable] = useState(false)
  const [reason, setReason] = useState('')
  const [requestId, setRequestId] = useState('')
  const [oldOtp, setOldOtp] = useState('')
  const [newOtp, setNewOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submitRequest(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await requestEmailChange({ newEmail, oldEmailUnavailable: oldUnavailable, reason })
      if (result.mode === 'admin_review') {
        setMessage('Request submitted. An administrator will review it and can approve the change without the old-email OTP.')
      } else {
        setRequestId(result.requestId)
        setMessage('Two verification codes were sent: one to your old email and one to your new email.')
      }
    } catch (e) { setError(e.message || 'Could not submit email-change request.') }
    finally { setBusy(false) }
  }

  async function verify(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await verifyEmailChange({ requestId, oldOtp, newOtp })
      await auth.currentUser?.reload?.().catch?.(() => {})
      await refreshUser?.()
      setMessage('Email address changed successfully. Your new email is now the login email.')
      setRequestId(''); setOldOtp(''); setNewOtp(''); setNewEmail('')
    } catch (e) { setError(e.message || 'Could not verify the email change.') }
    finally { setBusy(false) }
  }

  return <div className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4 space-y-4">
    <div className="flex items-start gap-3"><span className="rm-feature-icon"><Mail size={17}/></span><div><h3 className="font-bold text-ink">Change email address</h3><p className="text-xs text-ink-soft mt-1">Current login email: <strong>{user?.email || 'Not available'}</strong></p></div></div>
    {!requestId ? <form onSubmit={submitRequest} className="space-y-3">
      <input type="email" required value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="New email address" autoComplete="email" className="w-full"/>
      <label className="flex items-start gap-3 rounded-xl border border-[var(--rm-border)] p-3"><input type="checkbox" checked={oldUnavailable} onChange={e=>setOldUnavailable(e.target.checked)} className="mt-1"/><span><strong className="block text-sm">I cannot access my old email</strong><span className="text-xs text-ink-soft">This sends the request to the administrator for manual review.</span></span></label>
      {oldUnavailable && <textarea required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why you cannot access the old email" className="w-full min-h-24"/>}
      <button disabled={busy} className="rm-hero-button w-full justify-center"><ShieldAlert size={16}/>{busy?'Submitting…':'Request email change'}</button>
    </form> : <form onSubmit={verify} className="space-y-3">
      <div className="rounded-xl bg-brand/5 border border-brand/15 p-3 text-xs text-ink-soft">Enter the OTP sent to your <strong>old email</strong> and the OTP sent to your <strong>new email</strong>. Codes expire in 10 minutes.</div>
      <input inputMode="numeric" maxLength={6} required value={oldOtp} onChange={e=>setOldOtp(e.target.value.replace(/\D/g,''))} placeholder="Old email OTP" className="w-full text-center tracking-[.35em] text-lg"/>
      <input inputMode="numeric" maxLength={6} required value={newOtp} onChange={e=>setNewOtp(e.target.value.replace(/\D/g,''))} placeholder="New email OTP" className="w-full text-center tracking-[.35em] text-lg"/>
      <button disabled={busy || oldOtp.length!==6 || newOtp.length!==6} className="rm-hero-button w-full justify-center"><CheckCircle2 size={16}/>{busy?'Verifying…':'Verify and change email'}</button>
    </form>}
    {message && <p className="text-sm text-stamp-green" role="status">{message}</p>}
    {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
  </div>
}
