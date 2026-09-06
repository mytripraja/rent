import { useState, useEffect } from 'react'
import { requestBooking, listBookings } from '../../services/bookingService'
import { useAuth } from '../../context/AuthContext'

export default function BookCommonArea() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await listBookings()
    setBookings(data.filter(b => b.houseId === user.houseId))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.target)
    
    await requestBooking({
      area: fd.get('area'),
      houseId: user.houseId,
      tenantName: user.name || 'Tenant',
      date: fd.get('date'),
      timeSlot: fd.get('timeSlot'),
      purpose: fd.get('purpose')
    })
    
    e.target.reset()
    setLoading(false)
    load()
  }

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <h1 className="text-2xl font-display text-cover mb-6">Book Common Area</h1>
      
      <form onSubmit={handleSubmit} className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/10 mb-8 space-y-4">
        <select name="area" required className="w-full p-2 border border-ink/20 rounded bg-paper">
          <option value="terrace">Terrace</option>
          <option value="hall">Community Hall</option>
          <option value="garden">Garden Area</option>
        </select>
        
        <input name="date" type="date" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
        <input name="timeSlot" placeholder="e.g., 4:00 PM - 8:00 PM" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
        <input name="purpose" placeholder="Event Purpose" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
        
        <button type="submit" disabled={loading} className="w-full py-3 bg-cover text-paper rounded-md">
          {loading ? 'Submitting...' : 'Request Booking'}
        </button>
      </form>

      <div className="space-y-4">
        <h2 className="font-medium text-lg">My Bookings</h2>
        {bookings.map(b => (
          <div key={b.id} className="bg-paper-raised p-3 rounded border border-ink/5 flex justify-between items-center">
            <div>
              <p className="font-medium capitalize">{b.area}</p>
              <p className="text-xs text-ink-soft">{b.date} • {b.timeSlot}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${b.status === 'approved' ? 'bg-stamp-green/20 text-stamp-green' : b.status === 'rejected' ? 'bg-stamp-red/20 text-stamp-red' : 'bg-stamp-amber/20 text-stamp-amber'}`}>
              {b.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
