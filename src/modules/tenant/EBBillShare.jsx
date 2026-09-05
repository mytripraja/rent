import { useEffect, useState } from 'react'
import { listEbBillCycles, houseShareFromBill, submitEbPayment, listEbPaymentsForHouse } from '../../services/ebBillService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'
import { useToast } from '../shared/ui/Toast'

export default function EBBillShare() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [cycles, setCycles] = useState([])
  const [payments, setPayments] = useState([])
  const [payingBill, setPayingBill] = useState(null)
  const [cashReceivers, setCashReceivers] = useState([])

  useEffect(() => {
    if (user?.houseId) refresh()
    getCashReceivers().then(setCashReceivers).catch((err) => {
      console.error(err)
      showToast({ message: "Failed to load cash receivers", type: "error" })
    })
  }, [user, showToast])

  async function refresh() {
    try {
      setCycles(await listEbBillCycles())
      setPayments(await listEbPaymentsForHouse(user.houseId))
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to load EB bills", type: "error" })
    }
  }

  function statusFor(billId) {
    const forBill = payments.filter((p) => p.billId === billId)
    if (forBill.some((p) => p.status === 'approved')) return 'paid'
    if (forBill.some((p) => p.status === 'waiting_approval')) return 'waiting_approval'
    return 'not_paid'
  }

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
      <h3 className="font-semibold text-ink mb-3">EB Bill Share</h3>
      <div className="space-y-3">
        {cycles.map((bill) => {
          const share = houseShareFromBill(bill, user.houseId)
          if (!share) return null // house was excluded (own meter) or not yet occupied
          const status = statusFor(bill.id)
          return (
            <div key={bill.id} className="border-b border-brass/15 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{bill.cycleLabel}</p>
                  <p className="text-xs text-ink-soft">Your share: ₹{share.shareAmount} · due {bill.dueDate}</p>
                </div>
                <ApprovalStatusBadge status={status} />
              </div>
              {status !== 'paid' && status !== 'waiting_approval' && (
                <button
                  onClick={() => setPayingBill({ bill, share })}
                  className="mt-2 text-xs text-brand font-medium hover:underline"
                >
                  Pay this share
                </button>
              )}
            </div>
          )
        })}
        {cycles.length === 0 && <p className="text-sm text-ink-soft">No EB bills yet.</p>}
      </div>

      {payingBill && (
        <PayEbShareModal
          bill={payingBill.bill}
          share={payingBill.share}
          user={user}
          cashReceivers={cashReceivers}
          onClose={() => setPayingBill(null)}
          onDone={() => {
            setPayingBill(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function PayEbShareModal({ bill, share, user, cashReceivers, onClose, onDone }) {
  const { showToast } = useToast()
  const defaultReceiver = cashReceivers.length > 0 ? cashReceivers[0] : ''
  const [form, setForm] = useState({ dateSent: '', mode: 'upi', cashReceivedBy: defaultReceiver, neighborHouseId: '' })
  const [proofFile, setProofFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitEbPayment({
        billId: bill.id,
        houseId: user.houseId,
        tenantId: user.uid,
        amount: share.shareAmount,
        dateSent: form.dateSent,
        mode: form.mode,
        cashReceivedBy: form.cashReceivedBy,
        neighborHouseId: form.neighborHouseId,
        proofFile,
        recordedBy: { uid: user.uid, name: user.name },
      })
      showToast({ message: "EB payment submitted successfully!", type: "success" })
      onDone()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to submit EB payment", type: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto space-y-3">
        <h3 className="font-semibold text-ink">Pay {bill.cycleLabel} — ₹{share.shareAmount}</h3>

        <input required type="date" value={form.dateSent} onChange={(e) => setForm({ ...form, dateSent: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
          <option value="upi">UPI</option>
          <option value="bank">Bank Transfer</option>
          <option value="cash">Cash</option>
          <option value="neighbor">Paid via Neighbor</option>
        </select>

        {form.mode === 'cash' && (
          <select value={form.cashReceivedBy} onChange={(e) => setForm({ ...form, cashReceivedBy: e.target.value })}
            className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
            {cashReceivers.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            <option value="others">Others</option>
          </select>
        )}

        {form.mode === 'neighbor' && (
          <input placeholder="Neighbor's door number" value={form.neighborHouseId}
            onChange={(e) => setForm({ ...form, neighborHouseId: e.target.value })}
            className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        )}

        {(form.mode === 'upi' || form.mode === 'bank') && (
          <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files[0])} className="w-full text-sm" />
        )}

        <div className="flex gap-2">
          <button disabled={submitting} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-paper border border-brass/30 text-ink-soft py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      </form>
    </div>
  )
}
