import { useEffect, useState } from 'react'
import { listRentHistory } from '../../services/rentService'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'
import { useAuth } from '../../context/AuthContext'
import RentReceipt from '../shared/RentReceipt'

export default function RentHistory() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [receiptPayment, setReceiptPayment] = useState(null)

  useEffect(() => {
    if (user?.houseId) {
      listRentHistory(user.houseId).then(setPayments)
    }
  }, [user])

  // Group payments by month
  const grouped = payments.reduce((acc, p) => {
    acc[p.month] = acc[p.month] || []
    acc[p.month].push(p)
    return acc
  }, {})

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-ink">Rent History</h3>
      {payments.length === 0 && <p className="text-sm text-ink-soft">No submissions yet.</p>}
      
      {Object.entries(grouped).map(([month, monthPayments]) => {
        // Find total approved amount
        const totalPaid = monthPayments
          .filter(p => p.status === 'approved')
          .reduce((sum, p) => sum + Number(p.amount), 0)
        
        // Expected rent is whatever rentAmount they are currently on.
        // It's just a UI guide, so we use their current context.
        const expectedRent = user?.rentAmount || 0
        const progress = expectedRent > 0 ? Math.min(100, (totalPaid / expectedRent) * 100) : 0
        const isFullyPaid = totalPaid >= expectedRent && expectedRent > 0

        return (
          <div key={month} className="border border-brass/20 rounded-xl overflow-hidden">
            <div className="bg-paper px-4 py-3 border-b border-brass/10">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-ink">{month}</span>
                <span className="text-sm font-semibold text-ink">
                  ₹{totalPaid} {expectedRent > 0 && <span className="text-ink-soft font-normal">/ ₹{expectedRent}</span>}
                </span>
              </div>
              {expectedRent > 0 && (
                <div className="w-full bg-brass/20 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${isFullyPaid ? 'bg-stamp-green' : 'bg-brand'}`} style={{ width: `${progress}%` }}></div>
                </div>
              )}
            </div>
            <div className="divide-y divide-brass/10">
              {monthPayments.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between bg-paper-raised">
                  <div>
                    <p className="text-sm text-ink font-medium">₹{p.amount}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      {p.mode}{p.uploadedByOwner ? ' · Uploaded by Owner' : ''} · App# {p.applicationNumber}
                    </p>
                    {p.status === 'approved' && (
                      <button onClick={() => setReceiptPayment(p)} className="text-[11px] text-brand hover:underline mt-1 block font-medium">
                        View Receipt
                      </button>
                    )}
                  </div>
                  <ApprovalStatusBadge status={p.status === 'approved' ? 'paid' : p.status} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
      
      {receiptPayment && (
        <RentReceipt 
          payment={receiptPayment} 
          house={{ internalDoorNumber: user.houseId }} 
          onClose={() => setReceiptPayment(null)} 
        />
      )}
    </div>
  )
}
