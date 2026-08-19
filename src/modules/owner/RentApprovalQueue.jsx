import { useEffect, useState } from 'react'
import { listPendingApprovals, approvePayment, rejectPayment } from '../../services/rentService'

export default function RentApprovalQueue() {
  const [pending, setPending] = useState([])
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setPending(await listPendingApprovals())
  }

  async function handleApprove(payment) {
    let neighborCollectedBy
    if (payment.mode === 'neighbor') {
      neighborCollectedBy = prompt('Who actually collected this from the neighbor? (deepu / rajavel / siva)')
    }
    await approvePayment(payment.id, { neighborCollectedBy })
    refresh()
  }

  async function handleReject() {
    await rejectPayment(rejectingId, reason)
    setRejectingId(null)
    setReason('')
    refresh()
  }

  if (pending.length === 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">No rent submissions waiting for approval.</p>
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">Pending Approvals</h2>
      {pending.map((p) => (
        <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">
              House {p.houseId} · {p.month} · ₹{p.amount}
              {p.uploadedByOwner && <span className="ml-2 text-xs text-blue-600">(Uploaded by Owner)</span>}
            </p>
            <p className="text-xs text-slate-500">
              Mode: {p.mode}{p.mode === 'cash' && ` · Received by ${p.cashReceivedBy}`}{p.mode === 'neighbor' && ` · Via neighbor house ${p.neighborHouseId}`}
            </p>
            <p className="text-xs text-slate-400">Sent: {p.dateSent} · App# {p.applicationNumber}</p>
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
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-3">
            <h3 className="font-semibold text-slate-800">Reason for rejection</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" rows={3} />
            <div className="flex gap-2">
              <button onClick={handleReject} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Reject</button>
              <button onClick={() => setRejectingId(null)} className="flex-1 bg-slate-100 py-2 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
