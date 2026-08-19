import { useEffect, useState } from 'react'
import { listHouses } from '../../services/houseService'
import { createNotice, listAllNotices, deleteNotice } from '../../services/noticeService'
import NoticeBanner from '../shared/NoticeBanner'

const TYPES = [
  { id: 'water', label: 'Water stop (blue)' },
  { id: 'eb', label: 'EB stop (yellow)' },
  { id: 'both', label: 'Water + EB stop (half/half)' },
  { id: 'urgent', label: 'Urgent (red)' },
  { id: 'general', label: 'General notice (white)' },
  { id: 'other', label: 'Other (gray)' },
]

export default function NoticeManager() {
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
      refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deleteNotice(id)
    refresh()
  }

  const now = Date.now()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Notices</h2>
        <p className="text-sm text-slate-500">Pinned banners tenants see on their dashboard.</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 max-w-lg">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        <textarea required rows={2} placeholder="Message" value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />

        <input placeholder="Time window (e.g. 10 AM – 2 PM)" value={form.windowText}
          onChange={(e) => setForm({ ...form, windowText: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />

        <input type="number" min="1" placeholder="Auto-expire after (hours) — leave blank to stay pinned"
          value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />

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
                    : 'bg-white text-slate-600 border-slate-300'
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
        <h3 className="text-sm font-semibold text-slate-700 mb-2">All Notices</h3>
        <div className="space-y-2 max-w-lg">
          {notices.map((n) => {
            const expired = n.expiresAt && n.expiresAt <= now
            return (
              <div key={n.id} className={expired ? 'opacity-40' : ''}>
                <NoticeBanner notice={n} />
                <div className="flex items-center justify-between -mt-2 mb-3 px-1">
                  <span className="text-xs text-slate-400">
                    {expired ? 'Expired' : 'Active'} · {n.targetHouseIds === 'all' ? 'All houses' : `${n.targetHouseIds.length} house(s)`}
                  </span>
                  <button onClick={() => handleDelete(n.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            )
          })}
          {notices.length === 0 && <p className="text-sm text-slate-400">No notices yet.</p>}
        </div>
      </div>
    </div>
  )
}
