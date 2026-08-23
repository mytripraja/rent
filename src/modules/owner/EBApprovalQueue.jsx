import { useEffect, useState } from 'react'
import { listPendingEbApprovals, approveEbPayment, rejectEbPayment } from '../../services/ebBillService'
import { useAuth } from '../../context/AuthContext'

export default function EBApprovalQueue() {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setPending(await listPendingEbApprovals())
  }

  async function handleApprove(payment) {
    let neighborCollectedBy
    if (payment.mode === 'neighbor') {
      neighborCollectedBy = prompt('Who actually collected this from the neighbor? (deepu / rajavel / siva)')
    }
    await approveEbPayment(payment.id, { neighborCollectedBy, actionedBy: { uid: user.uid, name: user.name } })
    refresh()
  }

  async function handleReject() {
    await rejectEbPayment(rejectingId, reason, { uid: user.uid, name: user.name })
    setRejectingId(null)
    setReason('')
    refresh()
  }

  if (pending.length === 0) {
    return <p className="text-sm text-ink-soft py-8 text-center">No EB bill submissions waiting for approval.</p>
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">EB Bill — Pending Approvals</h2>
      {pending.map((p) => (
        <div key={p.id} className="bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="text-sm font-medium text-ink">
              House {p.houseId} · ₹{p.amount}
              {p.uploadedByOwner && <span className="ml-2 text-xs text-blue-600">(Uploaded by Owner)</span>}
            </p>
            <p className="text-xs text-ink-soft">
              Mode: {p.mode}{p.mode === 'cash' && ` · Received by ${p.cashReceivedBy}`}{p.mode === 'neighbor' && ` · Via neighbor house ${p.neighborHouseId}`}
            </p>
            <p className="text-xs text-ink-soft">Sent: {p.dateSent} · App# {p.applicationNumber}</p>
            {p.recordedBy && <p className="text-xs text-ink-soft">Entered by {p.recordedBy.name}</p>}
            {p.proofUrl && (
              <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                View proof screenshot
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleApprove(p)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">
              Approve
            </button>
            <button onClick={() => setRejectingId(p.id)} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium">
              Reject
            </button>
          </div>
        </div>
      ))}

      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-3">
            <h3 className="font-semibold text-ink">Reason for rejection</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" rows={3} />
            <div className="flex gap-2">
              <button onClick={handleReject} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Reject</button>
              <button onClick={() => setRejectingId(null)} className="flex-1 bg-paper border border-brass/30 text-ink-soft py-2 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
