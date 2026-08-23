import { useState } from 'react'
import { submitRentPayment } from '../../services/rentService'
import { useAuth } from '../../context/AuthContext'

const CASH_RECEIVERS = ['deepu', 'rajavel', 'siva', 'hemalathe', 'others']

export default function RentSubmission({ onSubmitted }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    month: '',
    amount: '',
    dateSent: '',
    mode: 'upi',
    cashReceivedBy: 'deepu',
    neighborHouseId: '',
  })
  const [proofFile, setProofFile] = useState(null)
  const [applicationNumber, setApplicationNumber] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const appNo = await submitRentPayment({
        houseId: user.houseId,
        tenantId: user.uid,
        month: form.month,
        amount: Number(form.amount),
        dateSent: form.dateSent,
        mode: form.mode,
        cashReceivedBy: form.cashReceivedBy,
        neighborHouseId: form.neighborHouseId,
        proofFile,
        recordedBy: { uid: user.uid, name: user.name },
      })
      setApplicationNumber(appNo)
      onSubmitted && onSubmitted()
    } finally {
      setSubmitting(false)
    }
  }

  if (applicationNumber) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p className="text-sm text-green-700 font-medium">Submitted for approval</p>
        <p className="text-xs text-green-600 mt-1">Application #{applicationNumber}</p>
        <button onClick={() => setApplicationNumber(null)} className="mt-4 text-xs text-brand hover:underline">
          Submit another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-3 max-w-md">
      <h3 className="font-semibold text-ink">Submit Rent Payment</h3>

      <input type="month" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
        className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

      <input type="number" required placeholder="Amount sent (₹)" value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

      <input type="date" required value={form.dateSent} onChange={(e) => setForm({ ...form, dateSent: e.target.value })}
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
          {CASH_RECEIVERS.map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      )}

      {form.mode === 'neighbor' && (
        <input placeholder="Neighbor's door number" value={form.neighborHouseId}
          onChange={(e) => setForm({ ...form, neighborHouseId: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
      )}

      {(form.mode === 'upi' || form.mode === 'bank') && (
        <div>
          <label className="text-xs text-ink-soft">Payment screenshot</label>
          <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files[0])}
            className="w-full text-sm mt-1" />
        </div>
      )}

      <button disabled={submitting} className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
        {submitting ? 'Submitting…' : 'Submit for Approval'}
      </button>
    </form>
  )
}
