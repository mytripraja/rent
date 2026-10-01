import { useEffect, useState } from 'react'
import { listEbBillCycles, houseShareFromBill, submitEbPayment, listEbPaymentsForHouse, listEbMeterReadings } from '../../services/ebBillService'
import { getCashReceivers, getAppConfig } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'
import { useToast } from '../shared/ui/Toast'

export default function EBBillShare() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [cycles, setCycles] = useState([])
  const [payments, setPayments] = useState([])
  const [meterReadings, setMeterReadings] = useState([])
  const [payingBill, setPayingBill] = useState(null)
  const [cashReceivers, setCashReceivers] = useState([])
  const [upiConfig, setUpiConfig] = useState(null)

  useEffect(() => {
    if (!user?.houseId) return
    refresh()
    getCashReceivers().then(setCashReceivers).catch(() => {})
    getAppConfig().then(config => {
      if (config.upiId && config.ownerName) setUpiConfig({ upiId: config.upiId, ownerName: config.ownerName })
    }).catch(() => {})
  }, [user?.houseId])

  async function refresh() {
    // Load each EB data source independently. A permission/index/network issue
    // in one query must not hide the other information tenants can still view.
    const results = await Promise.allSettled([
      listEbBillCycles(user.houseId),
      listEbPaymentsForHouse(user.houseId),
      listEbMeterReadings(user.houseId),
    ])
    const [billResult, paymentResult, readingResult] = results
    if (billResult.status === 'fulfilled') setCycles(billResult.value)
    else console.error('EB bill cycles failed to load:', billResult.reason)
    if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value)
    else console.error('EB payment history failed to load:', paymentResult.reason)
    if (readingResult.status === 'fulfilled') setMeterReadings(readingResult.value)
    else console.error('EB meter history failed to load:', readingResult.reason)
    if (results.some(result => result.status === 'rejected')) {
      showToast({ message: 'Some EB information could not be loaded. Other available records are still shown.', type: 'error' })
    }
  }

  function statusFor(billId) {
    const forBill = payments.filter((p) => p.billId === billId)
    if (forBill.some((p) => p.status === 'approved')) return 'paid'
    if (forBill.some((p) => p.status === 'waiting_approval')) return 'waiting_approval'
    return 'not_paid'
  }

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-ink">EB Bill & Meter Record</h3>
        <p className="text-xs text-ink-soft mt-1">See the official bill information, payment deadline, and meter readings recorded by the property owner.</p>
      </div>

      <div className="rounded-xl border border-brass/20 bg-paper p-4">
        <div className="flex items-center justify-between mb-3"><h4 className="text-sm font-semibold text-ink">Meter reading history</h4><span className="text-[11px] text-ink-soft">Physical observations</span></div>
        {meterReadings.length ? <div className="space-y-2">{meterReadings.slice(0, 8).map((r, index) => {
          const previous = meterReadings[index + 1]
          const units = previous ? Math.max(0, Number(r.reading) - Number(previous.reading)) : null
          return <div key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs border-b border-brass/10 pb-2 last:border-0 last:pb-0">
            <div><span className="font-medium text-ink">{Number(r.reading).toLocaleString('en-IN')} kWh</span>{units != null && <span className="text-ink-soft"> · {units.toLocaleString('en-IN')} units since previous record</span>}</div>
            <div className="text-ink-soft">{r.readingDate || '—'}{r.readingTime ? ` · ${r.readingTime}` : ''}{r.note ? ` · ${r.note}` : ''}{r.recordedByUid ? ' · recorded by property manager' : ''}</div>
          </div>
        })}</div> : <p className="text-xs text-ink-soft">No physical meter reading has been recorded yet.</p>}
      </div>

      <div className="space-y-3">
        {cycles.map((bill) => {
          const share = houseShareFromBill(bill, user.houseId)
          if (!share) return null
          const status = statusFor(bill.id)
          return (
            <div key={bill.id} className="rounded-xl border border-brass/15 bg-paper p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{bill.cycleLabel}</p>
                  <p className="text-xs text-ink-soft mt-1">Your share: ₹{share.shareAmount} · payment due: {bill.dueDate || '—'}</p>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-ink-soft">
                    <span>Total bill: ₹{Number(bill.totalAmount || 0).toLocaleString('en-IN')}</span>
                    <span>Bill units: {bill.consumptionUnits != null ? Number(bill.consumptionUnits).toLocaleString('en-IN') : 'Not recorded'}</span>
                    <span>Previous: {bill.previousMeterReading ?? '—'}</span>
                    <span>Current: {bill.currentMeterReading ?? '—'}</span>
                  </div>
                  {(bill.meterReadingDate || bill.meterReadingTime) && <p className="text-[11px] text-ink-soft mt-1">Government bill reading recorded: {bill.meterReadingDate || 'date not given'}{bill.meterReadingTime ? ` at ${bill.meterReadingTime}` : ''}</p>}
                </div>
                <ApprovalStatusBadge status={status} />
              </div>
              {status !== 'paid' && status !== 'waiting_approval' && <button onClick={() => setPayingBill({ bill, share })} className="mt-3 text-xs text-brand font-medium hover:underline">Pay this share</button>}
            </div>
          )
        })}
        {cycles.length === 0 && <p className="text-sm text-ink-soft">No EB bills yet.</p>}
      </div>

      {payingBill && <PayEbShareModal bill={payingBill.bill} share={payingBill.share} user={user} cashReceivers={cashReceivers} upiConfig={upiConfig} onClose={() => setPayingBill(null)} onDone={() => { setPayingBill(null); refresh() }} />}
    </div>
  )
}

import { generateUpiLink } from '../../utils/upiDeepLink'
function PayEbShareModal({ bill, share, user, cashReceivers, upiConfig, onClose, onDone }) {
  const { showToast } = useToast()
  const defaultReceiver = cashReceivers.length > 0 ? cashReceivers[0] : ''
  const [form, setForm] = useState({ dateSent: '', mode: 'upi', cashReceivedBy: defaultReceiver, neighborHouseId: '' })
  const [proofFile, setProofFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  async function submit(e) { e.preventDefault(); setSubmitting(true); try { await submitEbPayment({ billId: bill.id, houseId: user.houseId, tenantId: user.uid, amount: share.shareAmount, dateSent: form.dateSent, mode: form.mode, cashReceivedBy: form.cashReceivedBy, neighborHouseId: form.neighborHouseId, proofFile, recordedBy: { uid: user.uid, name: user.name } }); showToast({ message: 'EB payment submitted successfully!', type: 'success' }); onDone() } catch (err) { console.error(err); showToast({ message: err.message || 'Failed to submit EB payment', type: 'error' }) } finally { setSubmitting(false) } }
  const handlePayViaUPI = () => { if (!upiConfig) return; window.location.href = generateUpiLink({ payeeName: upiConfig.ownerName, payeeUpi: upiConfig.upiId, amount: share.shareAmount, transactionNote: `EB Bill ${bill.cycleLabel} for House ${user.houseId}` }) }
  return <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><form onSubmit={submit} className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto space-y-3"><h3 className="font-semibold text-ink">Pay {bill.cycleLabel} — ₹{share.shareAmount}</h3>{upiConfig && <div className="mb-4 bg-stamp-green/10 border border-stamp-green/30 rounded-xl p-4 text-center"><p className="text-sm text-stamp-green mb-3 font-medium">Quick Pay</p><button type="button" onClick={handlePayViaUPI} className="w-full bg-stamp-green text-white py-2.5 rounded-lg text-sm font-medium">Pay via UPI</button><p className="text-[10px] text-stamp-green/70 mt-2">Click here to open GPay/PhonePe</p></div>}<input required type="date" value={form.dateSent} onChange={(e) => setForm({ ...form, dateSent: e.target.value })} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" /><select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm"><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="cash">Cash</option><option value="neighbor">Paid via Neighbor</option></select>{form.mode === 'cash' && <select value={form.cashReceivedBy} onChange={(e) => setForm({ ...form, cashReceivedBy: e.target.value })} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">{cashReceivers.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}<option value="others">Others</option></select>}{form.mode === 'neighbor' && <input placeholder="Neighbor's door number" value={form.neighborHouseId} onChange={(e) => setForm({ ...form, neighborHouseId: e.target.value })} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />}{(form.mode === 'upi' || form.mode === 'bank') && <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files[0])} className="w-full text-sm" />}<div className="flex gap-2"><button disabled={submitting} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">{submitting ? 'Submitting…' : 'Submit'}</button><button type="button" onClick={onClose} className="flex-1 bg-paper border border-brass/30 text-ink-soft py-2 rounded-lg text-sm font-medium">Cancel</button></div></form></div>
}
