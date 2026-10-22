import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listHouses } from '../../services/houseService'
import { submitRentPayment, approvePayment, listPendingApprovals, listRentHistory } from '../../services/rentService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'

export default function ManualEntryForTenant() {
  const { user } = useAuth()
  const location = useLocation()
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [form, setForm] = useState({
    houseId: '', month: currentMonth, amount: '', dateSent: '', mode: 'cash', cashReceivedBy: '', paidBy: '', notes: '',
  })
  const [proofFile, setProofFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const [cashReceivers, setCashReceivers] = useState([])
  const [existingEntries, setExistingEntries] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  useEffect(() => {
    listHouses().then((all) => setHouses(all.filter((h) => h.status === 'occupied'))).catch((err) => {
      console.error(err)
      showToast({ message: "Failed to load houses", type: "error" })
    })

    getCashReceivers().then((receivers) => {
      setCashReceivers(receivers)
      if (receivers.length > 0) {
        setForm((prev) => ({ ...prev, cashReceivedBy: receivers[0] }))
      }
    }).catch((err) => {
      console.error(err)
      showToast({ message: "Failed to load cash receivers", type: "error" })
    })
  }, [showToast])

  const selectedHouse = houses.find((h) => h.id === form.houseId)

  useEffect(() => {
    const requestedHouse = location.state?.houseId
    if (requestedHouse) setForm(prev => ({ ...prev, houseId: requestedHouse }))
  }, [location.state?.houseId])

  useEffect(() => {
    let live = true
    if (!form.houseId || !form.month) { setExistingEntries([]); return () => { live = false } }
    setHistoryLoading(true)
    listRentHistory(form.houseId).then(rows => { if (live) setExistingEntries(rows.filter(row => row.month === form.month)) })
      .catch(err => { console.warn('Could not check existing rent entries', err); if (live) setExistingEntries([]) })
      .finally(() => { if (live) setHistoryLoading(false) })
    return () => { live = false }
  }, [form.houseId, form.month])

  async function submit() {
    setSaving(true)
    try {
      const applicationNumber = await submitRentPayment({
        houseId: form.houseId,
        tenantId: selectedHouse.currentTenantId,
        month: form.month,
        amount: Number(form.amount),
        dateSent: form.dateSent,
        mode: form.mode,
        cashReceivedBy: form.mode === 'cash' ? form.cashReceivedBy : null,
        paidBy: form.paidBy.trim(),
        notes: form.notes.trim(),
        proofFile,
        uploadedByOwner: true,
        recordedBy: { uid: user.uid, name: user.name },
      })
      setDone({ applicationNumber, submittedAt: Date.now() })
      showToast({ message: "Entry submitted successfully", type: "success" })
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to submit entry", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  async function approveNow(applicationNumber) {
    try {
      // Owner just entered this themself on the tenant's behalf, so approving
      // immediately (rather than going through the approval queue) is expected.
      let match = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const pending = await listPendingApprovals(houses.map((h) => h.id))
        match = pending.find((p) => p.applicationNumber === applicationNumber)
        if (match) break
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      if (match) {
        await approvePayment(match.id, { actionedBy: { uid: user.uid, name: user.name } })
        showToast({ message: "Approved successfully", type: "success" })
      } else {
        showToast({ message: "Payment found but took too long to appear in pending list. Please approve from the dashboard later.", type: "warning" })
      }
      setDone(null)
      const defaultReceiver = cashReceivers.length > 0 ? cashReceivers[0] : ''
      setForm({ houseId: '', month: currentMonth, amount: '', dateSent: '', mode: 'cash', cashReceivedBy: defaultReceiver, paidBy: '', notes: '' })
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to approve payment", type: "error" })
    }
  }

  if (done) {
    return (
      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-6 max-w-md text-center space-y-3">
        <p className="text-xs uppercase tracking-wider text-ink-soft">Rent entry reference number</p>
        <p className="text-xl font-bold tracking-wide text-brand">{done.applicationNumber}</p>
        <p className="text-xs text-ink-soft">Submitted on {new Date(done.submittedAt).toLocaleString('en-IN')} · Save this number to track the entry.</p>
        <p className="text-xs text-ink-soft">It'll show on the tenant's page as "Uploaded by Owner" once approved.</p>
        <button onClick={() => approveNow(done.applicationNumber)} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium">
          Approve immediately
        </button>
        <button onClick={() => setDone(null)} className="w-full bg-paper text-ink-soft py-2 rounded-lg text-sm font-medium">
          Enter another
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Manual Entry for Tenant</h2>
        <p className="text-sm text-ink-soft">For tenants who can't submit through the app themselves.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setReviewOpen(true) }} className="bg-paper-raised rounded-2xl border border-[var(--rm-border)] shadow-lg p-4 sm:p-5 space-y-4 max-w-xl">
        <div className="rounded-xl bg-brand/5 border border-brand/15 p-3"><p className="text-sm font-semibold text-ink">Record a rent payment</p><p className="text-xs text-ink-soft mt-1">Choose the house and month. Existing records appear below before you submit, so you can avoid duplicate entries.</p></div>
        <select required value={form.houseId} onChange={(e) => setForm({ ...form, houseId: e.target.value })}
          className="w-full min-h-11 border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30">
          <option value="">Select house</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName}</option>
          ))}
        </select>

        <input type="month" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
          className="w-full min-h-11 border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30" />

        {selectedHouse && <div className="rounded-xl border border-[var(--rm-border)] bg-paper p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-ink-soft">Selected resident</p><p className="font-semibold text-ink">{selectedHouse.tenantName}</p><p className="text-xs text-ink-soft">House {selectedHouse.internalDoorNumber} · Monthly rent ₹{Number(selectedHouse.rentAmount || 0).toLocaleString('en-IN')}</p></div><span className="rounded-full bg-brand/10 text-brand px-2 py-1 text-xs font-semibold">{form.month}</span></div><div className="mt-3 border-t border-[var(--rm-border)] pt-3"><p className="text-xs font-semibold text-ink">Existing entries for this month</p>{historyLoading ? <p className="text-xs text-ink-soft mt-1">Checking records…</p> : existingEntries.length ? <div className="mt-2 space-y-2">{existingEntries.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{row.dateSent || 'No date'} · ₹{Number(row.amount || 0).toLocaleString('en-IN')} · {row.applicationNumber || row.id}{row.paidBy ? ` · Paid by: ${row.paidBy}` : ''}{row.notes ? ` · Note: ${row.notes}` : ''}</span><span className={`rounded-full px-2 py-1 ${row.status === 'approved' ? 'bg-green-100 text-green-700' : row.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{row.status === 'approved' ? 'Approved' : row.status === 'rejected' ? 'Rejected' : 'Waiting approval'}</span></div>)}</div> : <p className="text-xs text-ink-soft mt-1">No rent entry found for this month.</p>}</div></div>}

        <input type="number" required min="1" placeholder="Amount (₹)" value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="w-full min-h-11 border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30" />

        <input type="date" required value={form.dateSent} onChange={(e) => setForm({ ...form, dateSent: e.target.value })}
          className="w-full min-h-11 border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30" />

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Who paid the rent? (optional)</label>
          <input type="text" maxLength={100} placeholder="Tenant / family member / other payer" value={form.paidBy}
            onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
            className="w-full min-h-11 border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Notes (optional)</label>
          <textarea rows={3} maxLength={1000} placeholder="Add a note about this rent payment…" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30 resize-y" />
        </div>

        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
          className="w-full min-h-11 border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank">Bank Transfer</option>
        </select>

        {form.mode === 'cash' && (
          <select value={form.cashReceivedBy} onChange={(e) => setForm({ ...form, cashReceivedBy: e.target.value })}
            className="w-full min-h-11 border border-[var(--rm-border)] rounded-xl px-3 py-2.5 text-sm bg-paper-raised focus:ring-2 focus:ring-brand/30">
            {cashReceivers.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            <option value="others">Others</option>
          </select>
        )}

        {(form.mode === 'upi' || form.mode === 'bank') && (
          <div>
            <label className="text-xs text-ink-soft">Proof screenshot (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files[0])} className="w-full text-sm mt-2 rounded-xl border border-[var(--rm-border)] p-3" />
          </div>
        )}

        <button disabled={saving} className="w-full min-h-12 bg-brand text-white py-3 rounded-xl text-sm font-semibold shadow-sm hover:brightness-105 disabled:opacity-60">
          {saving ? 'Submitting…' : 'Review before recording'}
        </button>
      </form>

      {reviewOpen && <div className="fixed inset-0 z-[90] bg-black/45 p-4 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="manual-entry-review-title"><div className="w-full max-w-md rounded-2xl bg-paper-raised border border-[var(--rm-border)] shadow-2xl p-5 space-y-4"><div><p className="text-xs font-bold uppercase tracking-wide text-brand">Manual entry · Review</p><h3 id="manual-entry-review-title" className="mt-1 font-display text-xl font-bold text-ink">Confirm payment details</h3></div><div className="divide-y divide-[var(--rm-border)] rounded-xl border border-[var(--rm-border)] bg-paper px-3"><ReviewRow label="House" value={selectedHouse?.internalDoorNumber || '—'} /><ReviewRow label="Tenant" value={selectedHouse?.tenantName || '—'} /><ReviewRow label="Rent month" value={form.month || '—'} /><ReviewRow label="Amount received" value={`₹${Number(form.amount || 0).toLocaleString('en-IN')}`} /><ReviewRow label="Payment date" value={form.dateSent || '—'} /><ReviewRow label="Method" value={form.mode} /></div><p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Confirm the funds were received and the house, tenant, month, and amount are correct. The payment will be submitted for the normal approval workflow.</p><div className="flex gap-2"><button type="button" onClick={() => setReviewOpen(false)} className="flex-1 min-h-11 rounded-lg border border-[var(--rm-border)] bg-white text-sm font-semibold text-ink">Back to edit</button><button type="button" disabled={saving} onClick={() => { setReviewOpen(false); submit() }} className="flex-1 min-h-11 rounded-lg bg-brand text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Recording…' : 'Confirm and record'}</button></div></div></div>}
    </div>
  )
}

function ReviewRow({ label, value }) { return <div className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="text-ink-soft">{label}</span><span className="text-right font-semibold text-ink">{value}</span></div> }
