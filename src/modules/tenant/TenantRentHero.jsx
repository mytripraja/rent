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

  if (!house) return <div className="rm-card p-5 animate-pulse"><div className="h-3 w-28 bg-ink/10 rounded"/><div className="h-9 w-36 bg-ink/10 rounded mt-3"/><div className="h-8 w-24 bg-ink/10 rounded mt-3"/></div>

  return (
    <div className="bg-cover text-paper rounded-2xl p-5 sm:p-6 shadow-lg overflow-hidden relative">
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-brass/10 pointer-events-none" aria-hidden="true"/>
      <div className="relative flex items-center justify-between gap-3"> 
      <div>
        <p className="font-mono-tab text-xs text-brass-light uppercase tracking-wide">
          {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · House {house.internalDoorNumber}
        </p>
        <p className="font-display text-3xl sm:text-4xl mt-1 tracking-tight">₹{Number(house.rentAmount || 0).toLocaleString('en-IN')}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap"><ApprovalStatusBadge status={status} /><span className="text-[11px] text-paper/70">Monthly rent</span></div>
      </div>
      {status !== 'paid' && (
        <button
          onClick={onPayNow}
          className="shrink-0 min-h-11 bg-brass text-cover-dark font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-brass-light transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-light"
        >
          {status === 'waiting_approval' ? 'View Status' : 'Pay Now'}
        </button>
      )}
      </div>
    </div>
  )
}
