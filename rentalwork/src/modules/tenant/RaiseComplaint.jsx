import { useEffect, useState } from 'react'
import { submitTenantComplaint, listComplaintsForHouse } from '../../services/complaintService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'

import { canPerformAction } from '../../utils/rateLimit'

export default function RaiseComplaint() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [complaints, setComplaints] = useState([])

  useEffect(() => {
    if (user?.houseId) refresh()
  }, [user])

  async function refresh() {
    try {
      setComplaints(await listComplaintsForHouse(user.houseId))
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to load complaints", type: "error" })
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!canPerformAction('raise_complaint', 5000)) {
      showToast({ message: "Please wait before submitting again.", type: "warning" })
      return
    }
    setSubmitting(true)
    try {
      await submitTenantComplaint({ fromHouseId: user.houseId, tenantId: user.uid, message })
      setMessage('')
      showToast({ message: "Complaint sent successfully", type: "success" })
      refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to send complaint", type: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-ink">Complaints</h3>

      <form onSubmit={submit} className="space-y-2">
        <textarea required rows={3} placeholder="Describe the issue — only the owner sees this"
          value={message} onChange={(e) => setMessage(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <button disabled={submitting} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {submitting ? 'Sending…' : 'Send to Owner'}
        </button>
      </form>

      <div className="space-y-2 pt-2 border-t border-brass/15">
        {complaints.map((c) => (
          <div key={c.id} className="text-sm border-b border-brass/15 pb-2">
            <p className="text-xs text-ink-soft mb-0.5">
              {c.direction === 'tenant_to_owner' ? 'You → Owner' : 'Owner → You'} · {new Date(c.createdAt).toLocaleDateString()}
            </p>
            <p className="text-ink">{c.message}</p>
            <span className={`text-xs mt-1 inline-block ${c.status === 'resolved' ? 'text-green-600' : 'text-amber-600'}`}>
              {c.status === 'resolved' ? 'Resolved' : 'Open'}
            </span>
          </div>
        ))}
        {complaints.length === 0 && <p className="text-sm text-ink-soft">No complaints yet.</p>}
      </div>
    </div>
  )
}
