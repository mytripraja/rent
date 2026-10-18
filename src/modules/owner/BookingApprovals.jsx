import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listBookings, approveBooking, rejectBooking } from '../../services/bookingService'
import { listHouses } from '../../services/houseService'
import SwipeableApprovalCard from '../shared/ui/SwipeableApprovalCard'
import { triggerHaptic } from '../../utils/haptics'

export default function BookingApprovals() {
  const [bookings, setBookings] = useState([])
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const houses = await listHouses()
    const data = await listBookings(null, null, houses.map(h => h.id))
    setBookings(data)
  }

  // Remove the row from state first so the card can animate out, then persist.
  async function runAction(booking, action) {
    if (busyId) return
    setBusyId(booking.id)
    setBookings(rows => rows.filter(r => r.id !== booking.id))
    try {
      await action()
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const pending = bookings.filter(b => b.status === 'pending')

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-6">Booking Approvals</h2>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {pending.length === 0 && (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-ink-soft">No pending requests.</motion.p>
          )}
          {pending.map(b => (
            <SwipeableApprovalCard
              key={b.id}
              hint="← Reject | Approve →"
              onApprove={() => runAction(b, () => approveBooking(b.id))}
              onReject={() => runAction(b, () => rejectBooking(b.id, 'Owner discretion'))}
            >
              <div className="p-4">
                <div className="flex justify-between">
                  <h3 className="font-bold text-lg capitalize">{b.area}</h3>
                  <span className="font-mono bg-ink/10 px-2 py-1 rounded text-xs">{b.houseId}</span>
                </div>
                <p className="text-ink-soft mt-1">{b.tenantName}</p>
                <p className="text-sm mt-2"><span className="font-medium">When:</span> {b.date} | {b.timeSlot}</p>
                <p className="text-sm"><span className="font-medium">Purpose:</span> {b.purpose}</p>

                <div className="flex gap-2 mt-4">
                  <button onClick={() => { triggerHaptic('success'); runAction(b, () => approveBooking(b.id)) }} className="flex-1 bg-stamp-green text-paper py-2 min-h-11 rounded">Approve</button>
                  <button onClick={() => { triggerHaptic('error'); runAction(b, () => rejectBooking(b.id, 'Owner discretion')) }} className="flex-1 border border-stamp-red text-stamp-red py-2 min-h-11 rounded">Reject</button>
                </div>
              </div>
            </SwipeableApprovalCard>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
