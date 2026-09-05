import { useEffect, useState } from 'react'
import { listOwners, createOwnerAccountAdmin, deleteOwnerAccount } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'

export default function OwnerManager() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [owners, setOwners] = useState([])
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingOwner, setDeletingOwner] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setOwners(await listOwners())
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
      setForm({ name: '', email: '', phone: '', password: '' })
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Adding…' : 'Add Owner'}
        </button>
      </form>

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
              <button onClick={() => setDeletingOwner(o)} className="text-xs text-red-600 hover:underline shrink-0">
                Remove
              </button>
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
