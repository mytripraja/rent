import { useEffect, useState } from 'react'
import { listHouses } from '../../services/houseService'
import { createNotice, listAllNotices, deleteNotice } from '../../services/noticeService'
import NoticeBanner from '../shared/NoticeBanner'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'

const TYPES = [
  { id: 'water', label: 'Water stop (blue)' },
  { id: 'eb', label: 'EB stop (yellow)' },
  { id: 'both', label: 'Water + EB stop (half/half)' },
  { id: 'urgent', label: 'Urgent (red)' },
  { id: 'general', label: 'General notice (white)' },
  { id: 'other', label: 'Other (gray)' },
]

export default function NoticeManager() {
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [notices, setNotices] = useState([])
  const [form, setForm] = useState({
    type: 'general',
    message: '',
    windowText: '',
    durationHours: '',
    audience: 'all', // 'all' | 'select'
    selectedHouseIds: [],
  })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setHouses(await listHouses())
    setNotices(await listAllNotices())
  }

  function toggleHouse(houseId) {
    setForm((f) => ({
      ...f,
      selectedHouseIds: f.selectedHouseIds.includes(houseId)
        ? f.selectedHouseIds.filter((id) => id !== houseId)
        : [...f.selectedHouseIds, houseId],
    }))
  }

  async function submit(e) {
    e.preventDefault()
    if (form.audience === 'select' && form.selectedHouseIds.length === 0) {
      showToast({ message: 'Please select at least one house.', type: 'error' })
      return
    }
    setSaving(true)
    try {
      await createNotice({
        type: form.type,
        message: form.message,
        windowText: form.windowText,
        durationHours: form.durationHours ? Number(form.durationHours) : null,
        targetHouseIds: form.audience === 'all' ? 'all' : form.selectedHouseIds,
      })
      setForm({ type: 'general', message: '', windowText: '', durationHours: '', audience: 'all', selectedHouseIds: [] })
      showToast({ message: 'Notice posted successfully', type: 'success' })
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to post notice: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function performDelete() {
    if (!deletingId) return
    try {
      await deleteNotice(deletingId)
      showToast({ message: 'Notice deleted successfully', type: 'success' })
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to delete notice: ' + err.message, type: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const now = Date.now()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-ink">Notices</h2>
        <p className="text-sm text-ink-soft">Pinned banners tenants see on their dashboard.</p>
      </div>

      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3 max-w-lg">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        <textarea required rows={2} placeholder="Message" value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <input placeholder="Time window (e.g. 10 AM – 2 PM)" value={form.windowText}
          onChange={(e) => setForm({ ...form, windowText: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <input type="number" min="1" placeholder="Auto-expire after (hours) — leave blank to stay pinned"
          value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={form.audience === 'all'} onChange={() => setForm({ ...form, audience: 'all' })} />
            All houses
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={form.audience === 'select'} onChange={() => setForm({ ...form, audience: 'select' })} />
            Select houses
          </label>
        </div>

        {form.audience === 'select' && (
          <div className="flex flex-wrap gap-2">
            {houses.map((h) => (
              <button
                type="button"
                key={h.id}
                onClick={() => toggleHouse(h.id)}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  form.selectedHouseIds.includes(h.id)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-paper-raised text-ink-soft border-brass/30'
                }`}
              >
                {h.internalDoorNumber}
              </button>
            ))}
          </div>
        )}

        <button disabled={saving} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Posting…' : 'Post Notice'}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-2">All Notices</h3>
        <div className="space-y-2 max-w-lg">
          {notices.map((n) => {
            const expired = n.expiresAt && n.expiresAt <= now
            return (
              <div key={n.id} className={expired ? 'opacity-40' : ''}>
                <NoticeBanner notice={n} />
                <div className="flex items-center justify-between -mt-2 mb-3 px-1">
                  <span className="text-xs text-ink-soft">
                    {expired ? 'Expired' : 'Active'} · {n.targetHouseIds === 'all' ? 'All houses' : `${n.targetHouseIds.length} house(s)`}
                  </span>
                  <button onClick={() => setDeletingId(n.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            )
          })}
          {notices.length === 0 && <p className="text-sm text-ink-soft">No notices yet.</p>}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Notice"
        message="Are you sure you want to delete this notice?"
        onConfirm={performDelete}
        onCancel={() => setDeletingId(null)}
        confirmText="Delete"
        danger
      />
    </div>
  )
}
