import { useEffect, useState } from 'react'
import { listRentHistory } from '../../services/rentService'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'
import { useAuth } from '../../context/AuthContext'

export default function RentHistory() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])

  useEffect(() => {
    if (user?.houseId) {
      listRentHistory(user.houseId).then(setPayments)
    }
  }, [user])

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="font-semibold text-slate-800 mb-3">Rent History</h3>
      {payments.length === 0 && <p className="text-sm text-slate-400">No submissions yet.</p>}
      <div className="space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b border-slate-50 pb-2">
            <div>
              <p className="text-sm text-slate-700">{p.month} · ₹{p.amount}</p>
              <p className="text-xs text-slate-400">
                {p.mode}{p.uploadedByOwner ? ' · Uploaded by Owner' : ''} · App# {p.applicationNumber}
              </p>
            </div>
            <ApprovalStatusBadge status={p.status === 'approved' ? 'paid' : p.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
