import { useEffect, useState } from 'react'
import { listHouses, setEbOverride } from '../../services/houseService'
import { calculateEbSplit, createEbBillCycle, listEbBillCycles, listEbMeterReadingsForHouses, recordEbMeterReadingsBulk } from '../../services/ebBillService'
import { useToast } from '../shared/ui/Toast'
import { createGoogleCalendarLink } from '../../utils/calendarLinks'
import { getActivePropertyId } from '../../services/configService'
import { CalendarPlus } from 'lucide-react'

export default function EBBillCreator() {
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [cycles, setCycles] = useState([])
  const [totalAmount, setTotalAmount] = useState('')
  const [cycleMonths, setCycleMonths] = useState(2)
  const [cycleLabel, setCycleLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdCycle, setCreatedCycle] = useState(null)
  const [meterRows, setMeterRows] = useState([])
  const [savingReadings, setSavingReadings] = useState(false)
  const [meterLoadError, setMeterLoadError] = useState('')
  const [billLoadError, setBillLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refresh()
  }, [])

  function localDate() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  function localTime() {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  async function refresh() {
    setLoading(true)
    setMeterLoadError('')
    setBillLoadError('')
    try {
      const houseRows = await listHouses()
      setHouses(houseRows)
      const occupied = houseRows.filter(h => h.status === 'occupied')

      // Load the bill list independently. A temporary bill-query failure must
      // not blank the physical meter register or the house adjustment screen.
      try {
        setCycles(await listEbBillCycles())
      } catch (err) {
        console.error('EB bill cycle load failed:', err)
        setCycles([])
        setBillLoadError('Previous EB bill cycles could not be loaded. You can still record meter readings.')
      }

      // The meter register must render even when there are no previous readings.
      // Give every occupied house an editable row immediately, with the current
      // date/time prefilled so a physical reading can be entered quickly.
      let readingRows = []
      try {
        readingRows = await listEbMeterReadingsForHouses(occupied.map(h => h.id), getActivePropertyId() || occupied[0]?.propertyId)
      } catch (err) {
        console.error('EB meter history load failed:', err)
        setMeterLoadError('Meter history could not be loaded. New readings can still be entered and saved after retrying.')
      }
      setMeterRows(occupied.map((h) => {
        const latest = readingRows.find(r => r.houseId === h.id)
        return {
          houseId: h.id,
          propertyId: h.propertyId,
          door: h.internalDoorNumber || h.govtDoorNumber || h.id,
          tenantName: h.tenantName || 'Vacant',
          // Keep the new-reading field blank. The previous value is shown
          // separately so an owner cannot accidentally resave an old reading.
          reading: '',
          readingDate: localDate(),
          readingTime: localTime(),
          note: '',
          lastReading: latest?.reading ?? null,
          lastReadingDate: latest?.readingDate || null,
          lastReadingTime: latest?.readingTime || null,
          lastRecordedAt: latest?.recordedAt || null,
        }
      }))
    } catch (err) {
      console.error(err)
      setMeterRows([])
      showToast({ message: err.message || 'Failed to load EB houses', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const occupiedHouses = houses.filter((h) => h.status === 'occupied')
  const preview =
    totalAmount && !isNaN(Number(totalAmount))
      ? calculateEbSplit(Number(totalAmount), Number(cycleMonths), houses)
      : []

  function updateMeterRow(houseId, field, value) {
    setMeterRows(rows => rows.map(row => row.houseId === houseId ? { ...row, [field]: value } : row))
  }

  async function saveMeterReadings() {
    const rows = meterRows.filter(row => row.reading !== '')
    if (!rows.length) { showToast({ message: 'Enter at least one meter reading.', type: 'error' }); return }
    const invalid = rows.find(row => row.reading === '' || !row.readingDate || !Number.isFinite(Number(row.reading)) || Number(row.reading) < 0)
    if (invalid) { showToast({ message: `Complete the reading and date for ${invalid.door}.`, type: 'error' }); return }
    setSavingReadings(true)
    try {
      await recordEbMeterReadingsBulk(rows, houses[0]?.propertyId)
      showToast({ message: 'Meter readings saved for the selected houses.', type: 'success' })
      await refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || 'Failed to save meter readings', type: 'error' })
    } finally { setSavingReadings(false) }
  }

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
        propertyId: houses[0]?.propertyId || 'default',
        cycleLabel,
        totalAmount: Number(totalAmount),
        cycleMonths: Number(cycleMonths),
        dueDate,
        previousMeterReading: document.getElementById('eb-previous-reading')?.value || '',
        currentMeterReading: document.getElementById('eb-current-reading')?.value || '',
        meterReadingDate: document.getElementById('eb-reading-date')?.value || '',
        meterReadingTime: document.getElementById('eb-reading-time')?.value || '',
      })
      setCreatedCycle({ label: cycleLabel, dueDate })
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

      {/* Physical meter register */}
      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">EB meter reading register</h3>
            <p className="text-xs text-ink-soft mt-1">Enter only the reading you physically see now. Previous readings stay visible for verification. Date and time are prefilled and can be changed.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={refresh} disabled={loading} className="border border-brass/30 text-ink px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
            <button type="button" onClick={saveMeterReadings} disabled={savingReadings || !meterRows.length} className="bg-brand text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">{savingReadings ? 'Saving…' : 'Save readings'}</button>
          </div>
        </div>
        {meterLoadError && <div className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">{meterLoadError}</div>}
        {billLoadError && <div className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">{billLoadError}</div>}
        {!loading && !meterRows.length && <div className="rounded-lg border border-brass/15 bg-paper px-3 py-3 text-xs text-ink-soft">No occupied houses are available in this apartment yet.</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead><tr className="text-left text-ink-soft border-b border-brass/15"><th className="py-2 pr-2">House / tenant</th><th className="py-2 pr-2">New reading (kWh)</th><th className="py-2 pr-2">Date</th><th className="py-2 pr-2">Time</th><th className="py-2 pr-2">Previous reading</th><th className="py-2">Note</th></tr></thead>
            <tbody>{meterRows.map(row => <tr key={row.houseId} className="border-b border-brass/10">
              <td className="py-2 pr-2"><span className="font-medium text-ink">{row.door}</span><span className="block text-ink-soft">{row.tenantName}</span></td>
              <td className="py-2 pr-2"><input inputMode="decimal" type="number" min="0" step="0.01" value={row.reading} onChange={e => updateMeterRow(row.houseId, 'reading', e.target.value)} onWheel={e => e.currentTarget.blur()} className="w-28 border border-brass/30 rounded px-2 py-1.5" placeholder="e.g. 10579" /></td>
              <td className="py-2 pr-2"><input type="date" value={row.readingDate} onChange={e => updateMeterRow(row.houseId, 'readingDate', e.target.value)} className="border border-brass/30 rounded px-2 py-1.5" /></td>
              <td className="py-2 pr-2"><input type="time" value={row.readingTime} onChange={e => updateMeterRow(row.houseId, 'readingTime', e.target.value)} className="border border-brass/30 rounded px-2 py-1.5" /></td>
              <td className="py-2 pr-2 text-ink-soft whitespace-nowrap">{row.lastReading != null ? <><span className="font-medium text-ink">{row.lastReading} kWh</span><span className="block">{row.lastReadingDate || ''}{row.lastReadingTime ? ` · ${row.lastReadingTime}` : ''}</span></> : 'No reading yet'}</td><td><input value={row.note} onChange={e => updateMeterRow(row.houseId, 'note', e.target.value)} className="w-40 border border-brass/30 rounded px-2 py-1.5" placeholder="Optional note" /></td>
            </tr>)}</tbody>
          </table>
        </div>
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
        <div className="rounded-xl bg-paper border border-brass/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-ink">Government bill reading (optional)</p>
          <p className="text-[11px] text-ink-soft">Use the official EB bill values when available. The system calculates consumption as current − previous; it does not claim an individual tenant's unit usage for a shared meter.</p>
          <div className="grid grid-cols-2 gap-2"><input id="eb-previous-reading" type="number" min="0" step="0.01" placeholder="Previous reading" className="border border-brass/30 rounded-lg px-3 py-2 text-sm" onWheel={e => e.currentTarget.blur()} /><input id="eb-current-reading" type="number" min="0" step="0.01" placeholder="Current reading" className="border border-brass/30 rounded-lg px-3 py-2 text-sm" onWheel={e => e.currentTarget.blur()} /></div>
          <div className="grid grid-cols-2 gap-2"><input id="eb-reading-date" type="date" className="border border-brass/30 rounded-lg px-3 py-2 text-sm" /><input id="eb-reading-time" type="time" className="border border-brass/30 rounded-lg px-3 py-2 text-sm" /></div>
        </div>

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

      {createdCycle && (
        <div className="bg-paper-raised border border-stamp-green p-3 rounded-lg flex items-center justify-between shadow-sm">
          <span className="text-sm font-medium text-ink flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stamp-green"></span>
            Cycle {createdCycle.label} created!
          </span>
          <a
            href={createGoogleCalendarLink({ title: `EB Bill Due: ${createdCycle.label}`, description: 'Collect EB Bills from tenants', date: createdCycle.dueDate, allDay: true })}
            target="_blank" rel="noopener noreferrer"
            className="text-xs bg-paper border border-brass/30 px-3 py-1.5 rounded-md text-brand hover:bg-brass/5 flex items-center gap-1.5"
          >
            <CalendarPlus size={14} /> Add due date to Calendar
          </a>
        </div>
      )}

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
