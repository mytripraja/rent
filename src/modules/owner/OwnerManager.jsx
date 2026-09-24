import { useEffect, useState } from 'react'
import { listOwners, createOwnerAccountAdmin, deleteOwnerAccount, setOwnerAppMode, listAdminUsers, setAdminUserDisabled, revokeAdminUserSessions, sendAdminPasswordReset } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'
import { getProperties } from '../../services/configService'
import { listEmailChangeRequests, approveEmailChange, rejectEmailChange } from '../../services/emailChangeService'

export default function OwnerManager() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [owners, setOwners] = useState([])
  const [accountUsers, setAccountUsers] = useState([])
  const [securityBusy, setSecurityBusy] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', appMode: null, propertyAccess: ['*'] })
  const [properties, setProperties] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingOwner, setDeletingOwner] = useState(null)
  const [emailRequests, setEmailRequests] = useState([])
  const [emailBusy, setEmailBusy] = useState('')

  useEffect(() => {
    refresh()
    getProperties().then(setProperties).catch(() => {})
    loadEmailRequests()
  }, [])

  async function refresh() {
    const [ownerRows, allUsers] = await Promise.all([listOwners(), listAdminUsers()])
    setOwners(ownerRows)
    setAccountUsers((allUsers.users || []).filter(x => x.role === 'owner' || x.role === 'admin'))
  }

  async function loadEmailRequests() {
    try { const result = await listEmailChangeRequests(); setEmailRequests(result.requests || []) } catch { setEmailRequests([]) }
  }

  async function decideEmailRequest(id, approve) {
    setEmailBusy(id)
    try {
      if (approve) await approveEmailChange(id)
      else await rejectEmailChange(id, 'Rejected by administrator')
      showToast({ message: approve ? 'Email change approved' : 'Email change request rejected', type: approve ? 'success' : 'info' })
      await loadEmailRequests(); await refresh()
    } catch (err) { showToast({ message: err.message || 'Could not update email request', type: 'error' }) }
    finally { setEmailBusy('') }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setSaving(true)
    try {
      await createOwnerAccountAdmin(form)
      setForm({ name: '', email: '', phone: '', password: '', appMode: null, propertyAccess: ['*'] })
      showToast({ message: 'Owner added successfully', type: 'success' })
      refresh()
    } catch (err) {
      setError(err.message)
      showToast({ message: 'Failed to add owner: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function performDelete() {
    if (!deletingOwner) return
    try {
      await deleteOwnerAccount(deletingOwner.uid)
      showToast({ message: 'Owner removed successfully', type: 'success' })
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to remove owner: ' + err.message, type: 'error' })
    } finally {
      setDeletingOwner(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Owner Management</h2>
        <p className="text-sm text-ink-soft">Add family or staff who need full owner access. Only you (the admin) can add or remove owners.</p>
      </div>

      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3 max-w-md">
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="email" placeholder="Email (used as login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <label className="flex items-start gap-3 rounded-xl border border-brass/20 bg-paper p-3 cursor-pointer">
          <input type="checkbox" checked={form.appMode === 'dad-lite'} onChange={(e) => setForm({ ...form, appMode: e.target.checked ? 'dad-lite' : null })} className="mt-1" />
          <span><span className="block text-sm font-semibold text-ink">Simple rent screen</span><span className="block text-xs text-ink-soft mt-0.5">Shows only tenant names, houses and a simple “Paid Rent” button.</span></span>
        </label>
        <div className="rounded-xl border border-brass/20 bg-paper p-3 space-y-3">
          <div><p className="text-sm font-semibold text-ink">Apartment access</p><p className="text-xs text-ink-soft mt-0.5">Choose whether this owner can switch between all apartments or only selected ones.</p></div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.propertyAccess.includes('*')} onChange={e => setForm({ ...form, propertyAccess: e.target.checked ? ['*'] : [] })}/><span>All apartments</span></label>
          {!form.propertyAccess.includes('*') && <div className="space-y-2 max-h-40 overflow-auto">{properties.map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.propertyAccess.includes(p.id)} onChange={e => { const next = e.target.checked ? [...form.propertyAccess, p.id] : form.propertyAccess.filter(x => x !== p.id); setForm({ ...form, propertyAccess: next }) }}/><span>{p.name}</span></label>)}</div>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Adding…' : 'Add Owner'}
        </button>
      </form>

      <div className="rounded-2xl border border-brand/15 bg-brand/5 p-4 space-y-3">
        <div><h3 className="font-bold text-ink">Email change requests</h3><p className="text-xs text-ink-soft mt-1">Review requests from users who cannot access their old email. Approval changes the Firebase login email and the app profile together.</p></div>
        {emailRequests.length === 0 ? <p className="text-sm text-ink-soft">No pending email-change requests.</p> : <div className="space-y-2">{emailRequests.map(r => <div key={r.id} className="rounded-xl border border-[var(--rm-border)] bg-paper-raised p-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-ink">{r.oldEmail} → {r.newEmail}</p><p className="text-xs text-ink-soft mt-1">{r.role || 'account'} · {r.oldEmailUnavailable ? 'Old email unavailable' : 'OTP verification pending'}</p>{r.reason && <p className="text-xs text-ink-soft mt-2">Reason: {r.reason}</p>}</div><div className="flex gap-2 shrink-0"><button disabled={emailBusy===r.id} onClick={()=>decideEmailRequest(r.id,true)} className="rm-hero-button px-3 py-2 text-xs">{emailBusy===r.id?'…':'Approve'}</button><button disabled={emailBusy===r.id} onClick={()=>decideEmailRequest(r.id,false)} className="rm-secondary-button px-3 py-2 text-xs">Reject</button></div></div>
        </div>)}</div>}
      </div>

      <div className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4 space-y-3">
        <div><h3 className="font-bold text-ink">Admin account security</h3><p className="text-xs text-ink-soft mt-1">Suspend an owner account, revoke all existing sessions, or send a secure password-reset email.</p></div>
        <div className="space-y-2">
          {accountUsers.map((a) => <div key={a.uid} className="rounded-xl border border-[var(--rm-border)] bg-paper p-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink truncate">{a.name || a.email} {a.role === 'admin' && <span className="text-xs text-brand">(Admin)</span>}</p><p className="text-xs text-ink-soft truncate">{a.email || 'No email'} · {a.disabled ? 'Suspended' : 'Active'}</p></div>
              <div className="flex flex-wrap gap-2">
                {a.uid !== user?.uid && <button disabled={securityBusy===a.uid} onClick={async()=>{setSecurityBusy(a.uid); try { await setAdminUserDisabled(a.uid,!a.disabled); showToast({message:a.disabled?'Account re-enabled':'Account suspended',type:'success'}); await refresh()} catch(e){showToast({message:e.message||'Could not update account',type:'error'})} finally{setSecurityBusy('')}}} className="rm-secondary-button px-3 py-2 text-xs">{a.disabled?'Enable':'Suspend'}</button>}
                <button disabled={securityBusy===a.uid} onClick={async()=>{setSecurityBusy(a.uid); try { await revokeAdminUserSessions(a.uid); showToast({message:'All sessions revoked',type:'success'})} catch(e){showToast({message:e.message||'Could not revoke sessions',type:'error'})} finally{setSecurityBusy('')}}} className="rm-secondary-button px-3 py-2 text-xs">Revoke sessions</button>
                <button disabled={securityBusy===a.uid} onClick={async()=>{setSecurityBusy(a.uid); try { await sendAdminPasswordReset(a.uid); showToast({message:'Password reset email sent',type:'success'})} catch(e){showToast({message:e.message||'Could not send reset email',type:'error'})} finally{setSecurityBusy('')}}} className="rm-secondary-button px-3 py-2 text-xs">Reset password</button>
              </div>
            </div>
          </div>)}
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        {owners.map((o) => (
          <div key={o.uid} className="bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-paper overflow-hidden flex items-center justify-center text-xs text-ink-soft shrink-0">
                {o.profilePhotoUrl ? <img src={o.profilePhotoUrl} alt="" className="w-full h-full object-cover" /> : o.name?.[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{o.name} {o.role === 'admin' && <span className="text-xs text-brand font-normal">(Super Admin)</span>}</p>
                <p className="text-xs text-ink-soft">{o.email}</p>
              </div>
            </div>
            {o.role === 'owner' && (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={async () => {
                    try {
                      const next = o.appMode === 'dad-lite' ? null : 'dad-lite'
                      await setOwnerAppMode(o.uid, next)
                      showToast({ message: next ? `${o.name} now has the simple rent screen` : `${o.name} now has the full owner screen`, type: 'success' })
                      refresh()
                    } catch (err) {
                      showToast({ message: 'Could not change screen mode', type: 'error' })
                    }
                  }}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${o.appMode === 'dad-lite' ? 'bg-brand text-white' : 'bg-paper text-ink-soft border border-brass/20'}`}
                >
                  {o.appMode === 'dad-lite' ? 'Simple' : 'Full'}
                </button>
                <button onClick={() => setDeletingOwner(o)} className="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!deletingOwner}
        title="Remove Owner"
        message={`Remove ${deletingOwner?.name}'s owner access? This can't be undone.`}
        onConfirm={performDelete}
        onCancel={() => setDeletingOwner(null)}
        confirmText="Remove"
        danger
      />
    </div>
  )
}
