import { useEffect, useState } from 'react'
import { addServiceContact, listServiceContacts, deleteServiceContact } from '../../services/serviceContactService'
import ServiceContactsList, { CATEGORY_LABELS, CATEGORY_ORDER } from '../shared/ServiceContactsList'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'

export default function ServiceContactsManager() {
  const { showToast } = useToast()
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({ category: 'eb_staff', label: '', phone: '', mapsUrl: '' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setContacts(await listServiceContacts())
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addServiceContact(form)
      setForm({ category: form.category, label: '', phone: '', mapsUrl: '' })
      showToast({ message: 'Contact added successfully', type: 'success' })
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to add contact: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function performDelete() {
    if (!deletingId) return
    try {
      await deleteServiceContact(deletingId)
      showToast({ message: 'Contact deleted successfully', type: 'success' })
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to delete contact: ' + err.message, type: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Service Contacts</h2>
        <p className="text-sm text-ink-soft">Visible to all tenants.</p>
      </div>

      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3 max-w-md">
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <input required placeholder="Label (e.g. 'Ravi - AC Repair')" value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Phone number" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Google Maps link (optional)" value={form.mapsUrl}
          onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <button disabled={saving} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Adding…' : 'Add Contact'}
        </button>
      </form>

      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 max-w-md">
        <ServiceContactsList
          contacts={contacts}
          renderAction={(c) => (
            <button type="button" onClick={() => setDeletingId(c.id)} className="text-xs text-red-600 hover:underline shrink-0 ml-2">
              Delete
            </button>
          )}
        />
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Contact"
        message="Are you sure you want to delete this service contact?"
        onConfirm={performDelete}
        onCancel={() => setDeletingId(null)}
        confirmText="Delete"
        danger
      />
    </div>
  )
}
