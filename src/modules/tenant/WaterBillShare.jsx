import { useEffect, useState } from 'react'
import { listWaterBillCycles, houseShareFromWaterBill, submitWaterPayment, listWaterPaymentsForHouse } from '../../services/waterBillService'
import { getCashReceivers, getAppConfig } from '../../services/configService'
import { generateUpiLink } from '../../utils/upiDeepLink'
import { useAuth } from '../../context/AuthContext'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'
import { useToast } from '../shared/ui/Toast'

export default function WaterBillShare() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [cycles, setCycles] = useState([])
  const [payments, setPayments] = useState([])
  const [payingBill, setPayingBill] = useState(null)
  const [cashReceivers, setCashReceivers] = useState([])
  const [upiConfig, setUpiConfig] = useState(null)

  const sharedBillId = new URLSearchParams(window.location.search).get('billType') === 'water' ? new URLSearchParams(window.location.search).get('billId') : null
  useEffect(() => {
    if (user?.houseId) refresh()
    getCashReceivers().then(setCashReceivers).catch((err) => {
      console.error(err)
      showToast({ message: "Failed to load cash receivers", type: "error" })
    })
    getAppConfig().then(config => {
      if (config.upiId && config.ownerName) setUpiConfig({ upiId: config.upiId, ownerName: config.ownerName })
    }).catch(() => {})
  }, [user, showToast])

  async function refresh() {
    try {
      setCycles((await listWaterBillCycles(user.houseId)).filter(bill => !sharedBillId || bill.id === sharedBillId))
      setPayments(await listWaterPaymentsForHouse(user.houseId))
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to load Water bills", type: "error" })
    }
  }

  function statusFor(billId) {
    const forBill = payments.filter((p) => p.billId === billId)
    if (forBill.some((p) => p.status === 'approved')) return 'paid'
    if (forBill.some((p) => p.status === 'waiting_approval')) return 'waiting_approval'
    return 'not_paid'
  }

  if (new URLSearchParams(window.location.search).get('billType') === 'eb') return null

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 mt-4">
      <h3 className="font-semibold text-ink mb-3">Water Bill Share</h3>
      <div className="space-y-3">
        {cycles.map((bill) => {
          const share = houseShareFromWaterBill(bill, user.houseId)
          if (!share) return null
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
        {cycles.length === 0 && <p className="text-sm text-ink-soft">No Water bills yet.</p>}
      </div>

      {payingBill && (
        <PayWaterShareModal
          bill={payingBill.bill}
          share={payingBill.share}
          user={user}
          cashReceivers={cashReceivers}
          upiConfig={upiConfig}
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

function PayWaterShareModal({ bill, share, user, cashReceivers, upiConfig, onClose, onDone }) {
  const { showToast } = useToast()
  const defaultReceiver = cashReceivers.length > 0 ? cashReceivers[0] : ''
  const [form, setForm] = useState({ dateSent: '', mode: 'upi', cashReceivedBy: defaultReceiver, neighborHouseId: '' })
  const [proofFile, setProofFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [applicationNumber, setApplicationNumber] = useState('')

  const handlePayViaUPI = () => {
    if (!upiConfig) return
    window.location.href = generateUpiLink({ payeeName: upiConfig.ownerName, payeeUpi: upiConfig.upiId, amount: share.shareAmount, transactionNote: `Water Bill ${bill.cycleLabel} for House ${user.houseId}` })
  }

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const reference = await submitWaterPayment({
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
      setApplicationNumber(reference || '')
      showToast({ message: `Water payment proof submitted. Reference: ${reference || 'submitted'}`, type: "success" })
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to submit Water payment", type: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto space-y-3">
        <h3 className="font-semibold text-ink">Pay {bill.cycleLabel} — ₹{share.shareAmount}</h3>
        {upiConfig && <div className="bg-stamp-green/10 border border-stamp-green/30 rounded-xl p-4 text-center"><p className="text-sm text-stamp-green mb-2 font-medium">Quick Pay · Fixed amount ₹{share.shareAmount}</p><button type="button" onClick={handlePayViaUPI} className="w-full bg-stamp-green text-white py-2.5 rounded-lg text-sm font-medium">Pay via UPI app</button><p className="text-[10px] text-stamp-green/70 mt-2">Opens a supported UPI app with the amount prefilled. Verify the amount before authorising payment.</p></div>}
        {applicationNumber && <div className="text-sm rounded-xl bg-stamp-green/10 border border-stamp-green/30 p-4 space-y-1"><p className="font-semibold text-stamp-green">Payment proof submitted</p><p>Bill: {bill.cycleLabel}</p><p>House: {share.houseId}</p><p>Amount: ₹{share.shareAmount}</p><p>Reference ID: <strong className="select-all">{applicationNumber}</strong></p><p className="text-xs">You can take a screenshot of this receipt and share it with the owner. Payment remains pending until verified.</p></div>}

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
          {!applicationNumber && <button disabled={submitting} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit payment proof'}
          </button>}
          <button type="button" onClick={applicationNumber ? onDone : onClose} className="flex-1 bg-paper border border-brass/30 text-ink-soft py-2 rounded-lg text-sm font-medium">{applicationNumber ? 'Done' : 'Cancel'}</button>
        </div>
      </form>
    </div>
  )
}
