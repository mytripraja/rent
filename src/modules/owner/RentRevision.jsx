import { useEffect, useState } from 'react'
import { listHouses, announceRentRevision, applyRentRevision, cancelRentRevision } from '../../services/houseService'

export default function RentRevision() {
  const [houses, setHouses] = useState([])
  const [form, setForm] = useState({ houseId: '', newRentAmount: '', effectiveMonth: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setHouses(await listHouses())
  }

  const occupied = houses.filter((h) => h.status === 'occupied')
  const pending = occupied.filter((h) => h.pendingRentAmount)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await announceRentRevision(form.houseId, Number(form.newRentAmount), form.effectiveMonth)
      setForm({ houseId: '', newRentAmount: '', effectiveMonth: '' })
      refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleApply(houseId) {
    await applyRentRevision(houseId)
    refresh()
  }

  async function handleCancel(houseId) {
    await cancelRentRevision(houseId)
    refresh()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Rent Revision</h2>
        <p className="text-sm text-slate-500">Announce an increase ahead of time — tenants see a banner until it takes effect.</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 max-w-md">
        <select required value={form.houseId} onChange={(e) => setForm({ ...form, houseId: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Select house</option>
          {occupied.map((h) => (
            <option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName} (current ₹{h.rentAmount})</option>
          ))}
        </select>
        <input required type="number" placeholder="New rent amount (₹)" value={form.newRentAmount}
          onChange={(e) => setForm({ ...form, newRentAmount: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required type="month" value={form.effectiveMonth}
          onChange={(e) => setForm({ ...form, effectiveMonth: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button disabled={saving} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Announcing…' : 'Announce Revision'}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Pending Revisions</h3>
        <div className="space-y-2 max-w-md">
          {pending.map((h) => (
            <div key={h.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">{h.internalDoorNumber} · {h.tenantName}</p>
                <p className="text-xs text-slate-500">₹{h.rentAmount} → ₹{h.pendingRentAmount} from {h.pendingRentEffectiveMonth}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleApply(h.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">Apply now</button>
                <button onClick={() => handleCancel(h.id)} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-medium">Cancel</button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-slate-400">No pending revisions.</p>}
        </div>
      </div>
    </div>
  )
}
