import { useEffect, useState } from 'react'
import { listHouses, setEbOverride } from '../../services/houseService'
import { calculateEbSplit, createEbBillCycle, listEbBillCycles } from '../../services/ebBillService'
import { useToast } from '../shared/ui/Toast'

export default function EBBillCreator() {
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [cycles, setCycles] = useState([])
  const [totalAmount, setTotalAmount] = useState('')
  const [cycleMonths, setCycleMonths] = useState(2)
  const [cycleLabel, setCycleLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      setHouses(await listHouses())
      setCycles(await listEbBillCycles())
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to load EB bill data", type: "error" })
    }
  }

  const occupiedHouses = houses.filter((h) => h.status === 'occupied')
  const preview =
    totalAmount && !isNaN(Number(totalAmount))
      ? calculateEbSplit(Number(totalAmount), Number(cycleMonths), houses)
      : []

  async function toggleOwnMeter(house) {
    try {
      await setEbOverride(house.id, {
        hasOwnEbMeter: !house.hasOwnEbMeter,
        ebShareOverrideMonths: house.ebShareOverrideMonths,
      })
      showToast({ message: "EB override updated", type: "success" })
      refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to update EB override", type: "error" })
    }
  }

  async function setPartialMonths(house, months) {
    try {
      await setEbOverride(house.id, {
        hasOwnEbMeter: house.hasOwnEbMeter,
        ebShareOverrideMonths: months === '' ? null : Number(months),
      })
      showToast({ message: "Months occupied updated", type: "success" })
      refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to update months occupied", type: "error" })
    }
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createEbBillCycle({
        cycleLabel,
        totalAmount: Number(totalAmount),
        cycleMonths: Number(cycleMonths),
        dueDate,
      })
      setTotalAmount('')
      setCycleLabel('')
      setDueDate('')
      showToast({ message: "Bill cycle created and sent", type: "success" })
      refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to create EB bill cycle", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-ink">EB Bill</h2>
        <p className="text-sm text-ink-soft">Every 2 months by default — override per house below if needed.</p>
      </div>

      {/* Per-house overrides */}
      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">House-level adjustments</h3>
        <div className="space-y-2">
          {occupiedHouses.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 text-sm border-b border-brass/15 pb-2">
              <span className="font-medium text-ink w-16">{h.internalDoorNumber}</span>
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={!!h.hasOwnEbMeter}
                  onChange={() => toggleOwnMeter(h)}
                />
                Has own EB meter (excluded from split)
              </label>
              {!h.hasOwnEbMeter && (
                <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                  Months occupied this cycle:
                  <input
                    type="number"
                    min="0"
                    max={cycleMonths}
                    placeholder={String(cycleMonths)}
                    defaultValue={h.ebShareOverrideMonths ?? ''}
                    onBlur={(e) => setPartialMonths(h, e.target.value)}
                    className="w-16 border border-brass/30 rounded px-2 py-1"
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create new cycle */}
      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3 max-w-md">
        <h3 className="text-sm font-semibold text-ink">New Bill Cycle</h3>
        <input required placeholder="Label (e.g. Jul-Aug 2026)" value={cycleLabel}
          onChange={(e) => setCycleLabel(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="number" placeholder="Total bill amount (₹)" value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="number" min="1" placeholder="Cycle length in months" value={cycleMonths}
          onChange={(e) => setCycleMonths(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        {preview.length > 0 && (
          <div className="bg-paper rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium text-ink-soft mb-1">Preview split:</p>
            {preview.map((s) => (
              <div key={s.houseId} className="flex justify-between">
                <span>{s.internalDoorNumber} {s.monthsOccupied < cycleMonths && `(${s.monthsOccupied}/${cycleMonths} mo)`}</span>
                <span className="font-medium">₹{s.shareAmount}</span>
              </div>
            ))}
          </div>
        )}

        <button disabled={saving} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Creating…' : 'Create & Send Bill'}
        </button>
      </form>

      {/* Past cycles */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-2">Past Cycles</h3>
        <div className="space-y-2">
          {cycles.map((c) => (
            <div key={c.id} className="bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{c.cycleLabel}</span>
                <span>₹{c.totalAmount} · due {c.dueDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
