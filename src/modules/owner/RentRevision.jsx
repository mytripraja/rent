import { useEffect, useState } from 'react'
import { listHouses, announceRentRevision, applyRentRevision, cancelRentRevision } from '../../services/houseService'

export default function RentRevision() {
  const [houses, setHouses] = useState([])
  const [effectiveMonth, setEffectiveMonth] = useState('')
  const [selections, setSelections] = useState({}) // { houseId: newAmount }
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setHouses(await listHouses())
  }

  const occupied = houses.filter((h) => h.status === 'occupied')
  const pending = occupied.filter((h) => h.pendingRentAmount)

  function toggleHouse(houseId, currentRent) {
    setSelections((s) => {
      const next = { ...s }
      if (houseId in next) delete next[houseId]
      else next[houseId] = String(currentRent)
      return next
    })
  }

  function setAmount(houseId, value) {
    setSelections((s) => ({ ...s, [houseId]: value }))
  }

  const selectedCount = Object.keys(selections).length

  // Different houses often get different increases — e.g. one house +500,
  // another +1000 — so each selected house has its own amount field rather
  // than one amount applied to everyone.
  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(selections).map(([houseId, amount]) =>
          announceRentRevision(houseId, Number(amount), effectiveMonth)
        )
      )
      setSelections({})
      setEffectiveMonth('')
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
        <h2 className="text-lg font-semibold text-ink">Rent Revision</h2>
        <p className="text-sm text-ink-soft">Something you'll only touch once or twice a year — pick the houses going up, set each one's new amount, and announce them together.</p>
      </div>

      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-lg">
        <div className="space-y-2">
          {occupied.map((h) => {
            const selected = h.id in selections
            return (
              <div key={h.id} className="flex items-center gap-3 border-b border-brass/15 pb-2">
                <label className="flex items-center gap-2 text-sm text-ink-soft w-40 shrink-0">
                  <input type="checkbox" checked={selected} onChange={() => toggleHouse(h.id, h.rentAmount)} />
                  {h.internalDoorNumber} · {h.tenantName}
                </label>
                <span className="text-xs text-ink-soft shrink-0">current ₹{h.rentAmount}</span>
                {selected && (
                  <input
                    type="number"
                    value={selections[h.id]}
                    onChange={(e) => setAmount(h.id, e.target.value)}
                    placeholder="New amount"
                    className="flex-1 border border-brass/30 rounded-lg px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            )
          })}
          {occupied.length === 0 && <p className="text-sm text-ink-soft">No occupied houses yet.</p>}
        </div>

        <div>
          <label className="text-xs text-ink-soft">Effective from (applies to all houses selected above)</label>
          <input required type="month" value={effectiveMonth} onChange={(e) => setEffectiveMonth(e.target.value)}
            className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>

        <button disabled={saving || selectedCount === 0} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Announcing…' : `Announce Revision (${selectedCount} house${selectedCount === 1 ? '' : 's'})`}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-2">Pending Revisions</h3>
        <div className="space-y-2 max-w-lg">
          {pending.map((h) => (
            <div key={h.id} className="bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{h.internalDoorNumber} · {h.tenantName}</p>
                <p className="text-xs text-ink-soft">₹{h.rentAmount} → ₹{h.pendingRentAmount} from {h.pendingRentEffectiveMonth}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleApply(h.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">Apply now</button>
                <button onClick={() => handleCancel(h.id)} className="text-xs bg-paper text-ink-soft px-3 py-1.5 rounded-lg font-medium">Cancel</button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-ink-soft">No pending revisions.</p>}
        </div>
      </div>
    </div>
  )
}
