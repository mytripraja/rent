import { useState, useEffect } from 'react'
import { listBookings, approveBooking, rejectBooking } from '../../services/bookingService'

export default function BookingApprovals() {
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await listBookings()
    setBookings(data)
  }

  const pending = bookings.filter(b => b.status === 'pending')

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <h1 className="text-2xl font-display text-cover mb-6">Booking Approvals</h1>
      
      <div className="space-y-4">
        {pending.length === 0 && <p className="text-ink-soft">No pending requests.</p>}
        {pending.map(b => (
          <div key={b.id} className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/10">
            <div className="flex justify-between">
              <h3 className="font-bold text-lg capitalize">{b.area}</h3>
              <span className="font-mono bg-ink/10 px-2 py-1 rounded text-xs">{b.houseId}</span>
            </div>
            <p className="text-ink-soft mt-1">{b.tenantName}</p>
            <p className="text-sm mt-2"><span className="font-medium">When:</span> {b.date} | {b.timeSlot}</p>
            <p className="text-sm"><span className="font-medium">Purpose:</span> {b.purpose}</p>
            
            <div className="flex gap-2 mt-4">
              <button onClick={() => approveBooking(b.id).then(load)} className="flex-1 bg-stamp-green text-paper py-2 rounded">Approve</button>
              <button onClick={() => rejectBooking(b.id, 'Owner discretion').then(load)} className="flex-1 border border-stamp-red text-stamp-red py-2 rounded">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
