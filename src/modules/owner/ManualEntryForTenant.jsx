import { useEffect, useState } from 'react'
import { listHouses } from '../../services/houseService'
import { submitRentPayment, approvePayment, listPendingApprovals } from '../../services/rentService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'

export default function ManualEntryForTenant() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [form, setForm] = useState({
    houseId: '', month: currentMonth, amount: '', dateSent: '', mode: 'cash', cashReceivedBy: '',
  })
  const [proofFile, setProofFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const [cashReceivers, setCashReceivers] = useState([])

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
        const pending = await listPendingApprovals()
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
      setForm({ houseId: '', month: currentMonth, amount: '', dateSent: '', mode: 'cash', cashReceivedBy: defaultReceiver })
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to approve payment", type: "error" })
    }
  }

  if (done) {
    return (
      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-6 max-w-md text-center space-y-3">
        <p className="text-sm text-ink-soft">Entry submitted. Application #{done}</p>
        <p className="text-xs text-ink-soft">It'll show on the tenant's page as "Uploaded by Owner" once approved.</p>
        <button onClick={() => approveNow(done)} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium">
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

      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3 max-w-md">
        <select required value={form.houseId} onChange={(e) => setForm({ ...form, houseId: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
          <option value="">Select house</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName}</option>
          ))}
        </select>

        <input type="month" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <input type="number" required placeholder="Amount (₹)" value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <input type="date" required value={form.dateSent} onChange={(e) => setForm({ ...form, dateSent: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank">Bank Transfer</option>
        </select>

        {form.mode === 'cash' && (
          <select value={form.cashReceivedBy} onChange={(e) => setForm({ ...form, cashReceivedBy: e.target.value })}
            className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
            {cashReceivers.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            <option value="others">Others</option>
          </select>
        )}

        {(form.mode === 'upi' || form.mode === 'bank') && (
          <div>
            <label className="text-xs text-ink-soft">Proof screenshot (optional)</label>
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
