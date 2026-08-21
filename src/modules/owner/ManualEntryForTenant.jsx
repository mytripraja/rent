import { useEffect, useState } from 'react'
import { listHouses } from '../../services/houseService'
import { submitRentPayment, approvePayment, listPendingApprovals } from '../../services/rentService'
import { useAuth } from '../../context/AuthContext'

const CASH_RECEIVERS = ['deepu', 'rajavel', 'siva', 'hemalathe', 'others']

export default function ManualEntryForTenant() {
  const { user } = useAuth()
  const [houses, setHouses] = useState([])
  const [form, setForm] = useState({
    houseId: '', month: '', amount: '', dateSent: '', mode: 'cash', cashReceivedBy: 'deepu',
  })
  const [proofFile, setProofFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    listHouses().then((all) => setHouses(all.filter((h) => h.status === 'occupied')))
  }, [])

  const selectedHouse = houses.find((h) => h.id === form.houseId)

  async function submit(e) {
    e.preventDefault()
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
        proofFile,
        uploadedByOwner: true,
        recordedBy: { uid: user.uid, name: user.name },
      })
      setDone(applicationNumber)
    } finally {
      setSaving(false)
    }
  }

  async function approveNow(applicationNumber) {
    // Owner just entered this themself on the tenant's behalf, so approving
    // immediately (rather than going through the approval queue) is expected.
    const pending = await listPendingApprovals()
    const match = pending.find((p) => p.applicationNumber === applicationNumber)
    if (match) await approvePayment(match.id, { actionedBy: { uid: user.uid, name: user.name } })
    setDone(null)
    setForm({ houseId: '', month: '', amount: '', dateSent: '', mode: 'cash', cashReceivedBy: 'deepu' })
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-md text-center space-y-3">
        <p className="text-sm text-slate-600">Entry submitted. Application #{done}</p>
        <p className="text-xs text-slate-400">It'll show on the tenant's page as "Uploaded by Owner" once approved.</p>
        <button onClick={() => approveNow(done)} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium">
          Approve immediately
        </button>
        <button onClick={() => setDone(null)} className="w-full bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-medium">
          Enter another
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Manual Entry for Tenant</h2>
        <p className="text-sm text-slate-500">For tenants who can't submit through the app themselves.</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 max-w-md">
        <select required value={form.houseId} onChange={(e) => setForm({ ...form, houseId: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Select house</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName}</option>
          ))}
        </select>

        <input type="month" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />

        <input type="number" required placeholder="Amount (₹)" value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />

        <input type="date" required value={form.dateSent} onChange={(e) => setForm({ ...form, dateSent: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />

        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank">Bank Transfer</option>
        </select>

        {form.mode === 'cash' && (
          <select value={form.cashReceivedBy} onChange={(e) => setForm({ ...form, cashReceivedBy: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {CASH_RECEIVERS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        )}

        {(form.mode === 'upi' || form.mode === 'bank') && (
          <div>
            <label className="text-xs text-slate-500">Proof screenshot (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files[0])} className="w-full text-sm mt-1" />
          </div>
        )}

        <button disabled={saving} className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Submitting…' : 'Submit Entry'}
        </button>
      </form>
    </div>
  )
}
