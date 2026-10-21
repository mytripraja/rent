import { useEffect, useState } from 'react'
import { listHouses } from '../../services/houseService'
import { listWaterBillCycles, submitWaterPayment, listPendingWaterApprovals, approveWaterPayment } from '../../services/waterBillService'
import { listEbBillCycles, submitEbPayment, listPendingEbApprovals, approveEbPayment } from '../../services/ebBillService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'

/** Owner-side recording for payments received outside the tenant app (GPay/cash/WhatsApp proof). */
export default function ManualUtilityPaymentEntry({ utility = 'water', onSaved }) {
  const isWater = utility === 'water'
  const { user } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [houses, setHouses] = useState([])
  const [cycles, setCycles] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ houseId: '', billId: '', amount: '', dateSent: new Date().toISOString().slice(0,10), mode: 'upi', paidBy: '', note: '' })

  useEffect(() => {
    if (!open) return
    Promise.all([listHouses(), isWater ? listWaterBillCycles() : listEbBillCycles()]).then(([h, c]) => {
      setHouses(h.filter(x => x.status === 'occupied'))
      setCycles(c)
    }).catch(e => showToast({ message: e.message || 'Could not load bill records', type: 'error' }))
  }, [open, isWater, showToast])

  const house = houses.find(h => h.id === form.houseId)
  const bill = cycles.find(c => c.id === form.billId)
  const share = (bill?.shares || []).find(s => s.houseId === form.houseId)
  const amountDefault = share ? Number(share.shareAmount || 0) : 0

  function selectHouse(houseId) {
    const available = cycles.filter(c => (c.shares || []).some(s => s.houseId === houseId))
    setForm(v => ({ ...v, houseId, billId: available[0]?.id || '', amount: String(Number(((available[0]?.shares || []).find(s => s.houseId === houseId)?.shareAmount) || 0)) }))
  }
  function selectBill(billId) {
    const selected = cycles.find(c => c.id === billId)
    const selectedShare = (selected?.shares || []).find(s => s.houseId === form.houseId)
    setForm(v => ({ ...v, billId, amount: String(Number(selectedShare?.shareAmount || 0)) }))
  }

  async function save(e) {
    e.preventDefault()
    if (!house || !bill) return showToast({ message: 'Choose a house and bill cycle first.', type: 'error' })
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) < 0) return showToast({ message: 'Enter a valid amount (zero is allowed).', type: 'error' })
    setSaving(true)
    try {
      const submit = isWater ? submitWaterPayment : submitEbPayment
      const pendingFn = isWater ? listPendingWaterApprovals : listPendingEbApprovals
      const approve = isWater ? approveWaterPayment : approveEbPayment
      const applicationNumber = await submit({
        billId: bill.id, houseId: house.id, tenantId: house.currentTenantId || house.tenantId || null,
        amount: Number(form.amount), dateSent: form.dateSent, mode: form.mode,
        cashReceivedBy: form.mode === 'cash' ? (user?.name || 'Owner') : null,
        uploadedByOwner: true,
        recordedBy: { uid: user?.uid || null, name: user?.name || 'Owner', note: form.note.trim(), paidBy: form.paidBy.trim(), manualUtilityEntry: true },
      })
      let match = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const rows = await pendingFn(houses.map(h => h.id))
        match = rows.find(p => p.applicationNumber === applicationNumber)
        if (match) break
        await new Promise(resolve => setTimeout(resolve, 350))
      }
      if (!match) throw new Error('Payment was recorded but could not be auto-approved. Please approve it from this queue.')
      await approve(match.id, { actionedBy: { uid: user?.uid || null, name: user?.name || 'Owner' } })
      showToast({ message: `${isWater ? 'Water' : 'EB'} payment recorded and marked paid.`, type: 'success' })
      setForm({ houseId: '', billId: '', amount: '', dateSent: new Date().toISOString().slice(0,10), mode: 'upi', paidBy: '', note: '' })
      setOpen(false)
      onSaved?.()
    } catch (e) { showToast({ message: e.message || 'Could not record manual payment', type: 'error' }) }
    finally { setSaving(false) }
  }

  const availableCycles = cycles.filter(c => !form.houseId || (c.shares || []).some(s => s.houseId === form.houseId))
  return <section className="rounded-xl border border-[var(--rm-border)] bg-paper-raised p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-ink">Manual {isWater ? 'water' : 'EB'} payment entry</h3><p className="text-xs text-ink-soft mt-1">For payments received through personal GPay, cash, bank transfer or WhatsApp proof.</p></div><button type="button" onClick={() => setOpen(v => !v)} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white">{open ? 'Close' : 'Record payment'}</button></div>
    {open && <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
      <label className="text-xs font-semibold text-ink-soft">House<select required value={form.houseId} onChange={e => selectHouse(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--rm-border)] bg-paper p-2.5 text-sm"><option value="">Select house</option>{houses.map(h => <option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName}</option>)}</select></label>
      <label className="text-xs font-semibold text-ink-soft">Bill cycle<select required value={form.billId} onChange={e => selectBill(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--rm-border)] bg-paper p-2.5 text-sm"><option value="">Select bill cycle</option>{availableCycles.map(c => <option key={c.id} value={c.id}>{c.cycleLabel || c.id}</option>)}</select></label>
      <label className="text-xs font-semibold text-ink-soft">Amount paid (₹)<input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} placeholder={String(amountDefault)} className="mt-1 w-full rounded-lg border border-[var(--rm-border)] bg-paper p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-ink-soft">Payment date<input required type="date" value={form.dateSent} onChange={e => setForm(v => ({ ...v, dateSent: e.target.value }))} className="mt-1 w-full rounded-lg border border-[var(--rm-border)] bg-paper p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-ink-soft">Payment method<select value={form.mode} onChange={e => setForm(v => ({ ...v, mode: e.target.value }))} className="mt-1 w-full rounded-lg border border-[var(--rm-border)] bg-paper p-2.5 text-sm"><option value="upi">GPay / UPI</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
      <label className="text-xs font-semibold text-ink-soft">Paid by (optional)<input value={form.paidBy} onChange={e => setForm(v => ({ ...v, paidBy: e.target.value }))} placeholder="Tenant / family member" className="mt-1 w-full rounded-lg border border-[var(--rm-border)] bg-paper p-2.5 text-sm"/></label>
      <label className="text-xs font-semibold text-ink-soft sm:col-span-2">Reference / WhatsApp screenshot note (optional)<input value={form.note} onChange={e => setForm(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Screenshot received on WhatsApp; UPI ref last 4 digits" className="mt-1 w-full rounded-lg border border-[var(--rm-border)] bg-paper p-2.5 text-sm"/></label>
      <p className="sm:col-span-2 text-xs text-amber-700">This records the payment and marks it approved. Keep the original payment screenshot securely; this form does not upload a screenshot file.</p>
      <button disabled={saving} className="sm:col-span-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save and mark as paid'}</button>
    </form>}
  </section>
}
