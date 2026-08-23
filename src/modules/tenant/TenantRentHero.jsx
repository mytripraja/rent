import { useEffect, useState } from 'react'
import { getHouse } from '../../services/houseService'
import { listRentHistory, resolveMonthStatus, currentMonthStr } from '../../services/rentService'
import { useAuth } from '../../context/AuthContext'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'

export default function TenantRentHero({ onPayNow }) {
  const { user } = useAuth()
  const [house, setHouse] = useState(null)
  const [status, setStatus] = useState('not_paid')

  useEffect(() => {
    if (user?.houseId) load()
  }, [user])

  async function load() {
    const h = await getHouse(user.houseId)
    setHouse(h)
    const payments = await listRentHistory(user.houseId)
    setStatus(resolveMonthStatus(payments, currentMonthStr()))
  }

  if (!house) return null

  return (
    <div className="bg-cover text-paper rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4">
      <div>
        <p className="font-mono-tab text-xs text-brass-light uppercase tracking-wide">
          {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · House {house.internalDoorNumber}
        </p>
        <p className="font-display text-3xl mt-1">₹{house.rentAmount}</p>
        <div className="mt-2"><ApprovalStatusBadge status={status} /></div>
      </div>
      {status !== 'paid' && (
        <button
          onClick={onPayNow}
          className="shrink-0 bg-brass text-cover-dark font-semibold text-sm px-4 py-2.5 rounded-full hover:bg-brass-light transition"
        >
          {status === 'waiting_approval' ? 'View Status' : 'Pay Now'}
        </button>
      )}
    </div>
  )
}
