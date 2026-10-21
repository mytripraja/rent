import { useEffect, useState } from 'react'
import { listHouses, setWaterOverride } from '../../services/houseService'
import { calculateWaterSplit, createWaterBillCycle, listWaterBillCycles } from '../../services/waterBillService'
import { useToast } from '../shared/ui/Toast'
import BillShareTools from './BillShareTools'

export default function WaterBillCreator() {
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [cycles, setCycles] = useState([])
  const [totalAmount, setTotalAmount] = useState('')
  const [cycleMonths, setCycleMonths] = useState(1)
  const [cycleLabel, setCycleLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [billNote, setBillNote] = useState('')
  const [includeCctvSim, setIncludeCctvSim] = useState(true)
  const [includeAnnualCleaning, setIncludeAnnualCleaning] = useState(false)
  const [annualCleaningAmount, setAnnualCleaningAmount] = useState('')
  const [paymentDetails, setPaymentDetails] = useState({ upiId: '', payeeName: '', bankName: '', accountName: '', accountNumber: '', ifsc: '', paymentInstructions: '' })
  const [sharingBill, setSharingBill] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      setHouses(await listHouses())
      setCycles(await listWaterBillCycles())
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to load Water bill data", type: "error" })
    }
  }

  const occupiedHouses = houses.filter((h) => h.status === 'occupied')
  const currentYear = new Date().getFullYear()
  const annualCleaningAlreadyCollected = cycles.some(c => (c.additionalCharges || []).some(item => item.label === 'Annual building cleaning' && Number(item.year) === currentYear))
  const additionalCharges = [
    ...(includeCctvSim ? [{ label: 'CCTV SIM recharge', amount: 250, frequency: 'monthly' }] : []),
    ...(includeAnnualCleaning && !annualCleaningAlreadyCollected && Number(annualCleaningAmount) >= 0 && annualCleaningAmount !== '' ? [{ label: 'Annual building cleaning', amount: Number(annualCleaningAmount), frequency: 'yearly', year: currentYear }] : []),
  ]
  const effectiveTotal = Math.max(0, Number(totalAmount || 0)) + additionalCharges.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const preview = totalAmount !== '' && !isNaN(Number(totalAmount))
      ? calculateWaterSplit(effectiveTotal, Number(cycleMonths), houses)
      : []

  async function setPartialMonths(house, months) {
    try {
      await setWaterOverride(house.id, {
        waterShareOverrideMonths: months === '' ? null : Number(months),
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
      await createWaterBillCycle({
        propertyId: houses[0]?.propertyId || 'default',
        cycleLabel,
        totalAmount: effectiveTotal,
        additionalCharges,
        cycleMonths: Number(cycleMonths),
        dueDate,
        note: billNote,
        paymentDetails,
      })
      setTotalAmount('')
      setCycleLabel('')
      setDueDate('')
      setBillNote('')
      setIncludeCctvSim(true)
      setIncludeAnnualCleaning(false)
      setAnnualCleaningAmount('')
      setPaymentDetails({ upiId: '', payeeName: '', bankName: '', accountName: '', accountNumber: '', ifsc: '', paymentInstructions: '' })
      showToast({ message: "Bill cycle created and sent", type: "success" })
      refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to create Water bill cycle", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-ink">Water Bill</h2>
        <p className="text-sm text-ink-soft">Every 1 month by default — override per house below if needed.</p>
      </div>

      {/* Per-house overrides */}
      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">House-level adjustments</h3>
        <div className="space-y-2">
          {occupiedHouses.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 text-sm border-b border-brass/15 pb-2">
              <span className="font-medium text-ink w-16">{h.internalDoorNumber}</span>
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                Months occupied this cycle:
                <input
                  type="number"
                  min="0"
                  max={cycleMonths}
                  placeholder={String(cycleMonths)}
                  defaultValue={h.waterShareOverrideMonths ?? ''}
                  onBlur={(e) => setPartialMonths(h, e.target.value)}
                  className="w-16 border border-brass/30 rounded px-2 py-1"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Create new cycle */}
      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3 max-w-md">
        <h3 className="text-sm font-semibold text-ink">New Bill Cycle</h3>
        <input required placeholder="Label (e.g. Jul 2026)" value={cycleLabel}
          onChange={(e) => setCycleLabel(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="number" min="0" placeholder="Water bill amount only (₹)" value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <div className="rounded-xl border border-brass/20 bg-paper p-3 space-y-3">
          <p className="text-xs font-semibold text-ink">Additional shared collections</p>
          <label className="flex items-center justify-between gap-3 text-sm"><span>CCTV SIM recharge <span className="text-ink-soft">(₹250)</span></span><input type="checkbox" checked={includeCctvSim} onChange={e=>setIncludeCctvSim(e.target.checked)} /></label>
          <label className="flex items-center justify-between gap-3 text-sm"><span>Annual building cleaning (once per year)</span><input type="checkbox" disabled={annualCleaningAlreadyCollected} checked={includeAnnualCleaning} onChange={e=>setIncludeAnnualCleaning(e.target.checked)} /></label>{annualCleaningAlreadyCollected && <p className="text-xs text-emerald-700">Annual cleaning has already been included in a bill cycle for {currentYear}; the option is disabled to help prevent duplicate collection.</p>}
          {includeAnnualCleaning && <input type="number" min="0" required={includeAnnualCleaning} value={annualCleaningAmount} onChange={e=>setAnnualCleaningAmount(e.target.value)} placeholder="Total annual cleaning collection (₹)" className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />}
          <p className="text-[11px] text-ink-soft">Selected charges are added to this cycle's total and split across eligible houses. The annual cleaning option is a manual once-a-year collection; check the previous cycles before selecting it again.</p>
          <p className="text-xs font-semibold">Total to split: ₹{effectiveTotal.toLocaleString('en-IN')}</p>
        </div>
        <input required type="number" min="1" placeholder="Cycle length in months" value={cycleMonths}
          onChange={(e) => setCycleMonths(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <textarea value={billNote} onChange={e => setBillNote(e.target.value)} rows={2} placeholder="Optional note for residents" className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <details className="rounded-xl border border-brass/20 p-3"><summary className="cursor-pointer text-sm font-semibold">Payment account for this Water bill</summary><p className="text-xs text-ink-soft mt-2">These details are shown on the bill link. Leave fields blank if you do not want to publish them.</p><div className="grid gap-2 mt-3"><input value={paymentDetails.payeeName} onChange={e=>setPaymentDetails({...paymentDetails,payeeName:e.target.value})} placeholder="UPI / account holder name" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={paymentDetails.upiId} onChange={e=>setPaymentDetails({...paymentDetails,upiId:e.target.value})} placeholder="UPI ID (e.g. name@bank)" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={paymentDetails.bankName} onChange={e=>setPaymentDetails({...paymentDetails,bankName:e.target.value})} placeholder="Bank name" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={paymentDetails.accountName} onChange={e=>setPaymentDetails({...paymentDetails,accountName:e.target.value})} placeholder="Bank account holder name" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={paymentDetails.accountNumber} onChange={e=>setPaymentDetails({...paymentDetails,accountNumber:e.target.value})} placeholder="Bank account number" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={paymentDetails.ifsc} onChange={e=>setPaymentDetails({...paymentDetails,ifsc:e.target.value.toUpperCase()})} placeholder="IFSC" className="w-full border rounded-lg px-3 py-2 text-sm"/><input value={paymentDetails.paymentInstructions} onChange={e=>setPaymentDetails({...paymentDetails,paymentInstructions:e.target.value})} placeholder="Payment instructions (optional)" className="w-full border rounded-lg px-3 py-2 text-sm"/></div></details>

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
              {Array.isArray(c.additionalCharges) && c.additionalCharges.length > 0 && <p className="text-xs text-ink-soft mt-1">Includes: {c.additionalCharges.map(x => `${x.label} ₹${x.amount}`).join(' · ')}</p>}
              {c.note && <p className="text-xs text-ink-soft mt-1">Note: {c.note}</p>}
              <button type="button" onClick={() => setSharingBill(c)} className="mt-2 bg-brand text-white rounded-lg px-3 py-1.5 text-xs">Share bill</button>
            </div>
          ))}
        </div>
      </div>
      {sharingBill && <BillShareTools bill={sharingBill} houses={houses} billType="Water" onClose={() => setSharingBill(null)} />}
    </div>
  )
}
