import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Clock3 } from 'lucide-react'
import { requestBooking, listBookings } from '../../services/bookingService'
import { useAuth } from '../../context/AuthContext'

const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00', '20:00–22:00']
const AREAS = [['terrace','Terrace'], ['hall','Community Hall'], ['garden','Garden Area']]

export default function BookCommonArea() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [area, setArea] = useState('terrace')
  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setDate(new Date().toISOString().slice(0,10)) }, [])
  useEffect(() => { if (user?.houseId) load() }, [user?.houseId, date])

  async function load() {
    try { setBookings(await listBookings(null, user.houseId)) } catch (e) { console.error(e); setError('Could not load your bookings.') }
  }

  const myBookings = useMemo(() => bookings.filter(b => b.houseId === user.houseId), [bookings, user.houseId])
  const selectedAreaBookings = myBookings.filter(b => b.area === area && b.date === date)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!timeSlot) return
    setLoading(true); setError('')
    try {
      await requestBooking({ area, houseId: user.houseId, tenantId: user.uid, tenantName: user.name || 'Tenant', date, timeSlot, purpose })
      setPurpose(''); setTimeSlot(''); await load()
    } catch (e) { console.error(e); setError(e?.message || 'Could not submit booking.') }
    finally { setLoading(false) }
  }

  return <div>
    <div className="flex items-center gap-2 mb-3"><CalendarDays size={18} className="text-brand"/><h3 className="font-semibold text-ink">Book Common Area</h3></div>
    <form onSubmit={handleSubmit} className="bg-paper-raised p-4 rounded-2xl shadow-sm border border-[var(--rm-border)] space-y-4">
      <div className="grid sm:grid-cols-2 gap-2">{AREAS.map(([id,label]) => <button type="button" key={id} onClick={() => {setArea(id);setTimeSlot('')}} className={`rounded-xl border p-3 text-left ${area === id ? 'border-brand bg-brand/10 text-brand font-bold' : 'border-[var(--rm-border)] text-ink-soft'}`}><span className="block text-sm">{label}</span><span className="text-[11px] opacity-70">Shared space</span></button>)}</div>
      <label className="block text-sm font-semibold text-ink-soft">Date<input value={date} onChange={e=>{setDate(e.target.value);setTimeSlot('')}} type="date" required className="mt-1 w-full"/></label>
      <div><div className="flex items-center gap-2 text-sm font-semibold text-ink-soft mb-2"><Clock3 size={15}/> Select a time slot</div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{SLOTS.map(slot => { const mine=selectedAreaBookings.find(b=>b.timeSlot===slot); const disabled=Boolean(mine && mine.status==='approved'); return <button type="button" key={slot} disabled={disabled} onClick={()=>setTimeSlot(slot)} className={`rounded-xl border p-3 text-xs font-semibold transition ${disabled ? 'opacity-40 cursor-not-allowed bg-paper' : timeSlot===slot ? 'border-brand bg-brand text-white' : 'border-[var(--rm-border)] bg-paper-raised text-ink hover:border-brand/50'}`}>{slot}{disabled && <span className="block text-[9px] mt-1">Your approved booking</span>}</button> })}</div></div>
      <label className="block text-sm font-semibold text-ink-soft">Purpose<input value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="Family function, meeting, etc." required className="mt-1 w-full"/></label>
      {error && <p className="text-sm text-stamp-red">{error}</p>}
      <button type="submit" disabled={loading || !timeSlot} className="w-full py-3 bg-cover text-white rounded-xl font-bold disabled:opacity-50">{loading ? 'Submitting…' : timeSlot ? `Request ${timeSlot}` : 'Select a time slot'}</button>
    </form>

    <div className="space-y-3 mt-6"><h2 className="font-medium text-lg text-ink">My bookings</h2>{myBookings.length ? myBookings.map(b => <div key={b.id} className="bg-paper-raised p-3 rounded-xl border border-[var(--rm-border)] flex justify-between gap-3 items-center"><div className="min-w-0"><p className="font-medium text-ink capitalize truncate">{b.area}</p><p className="text-xs text-ink-soft">{b.date} • {b.timeSlot}</p></div><span className={`shrink-0 text-xs px-2 py-1 rounded-full ${b.status === 'approved' ? 'bg-stamp-green/20 text-stamp-green' : b.status === 'rejected' ? 'bg-stamp-red/20 text-stamp-red' : 'bg-stamp-amber/20 text-stamp-amber'}`}>{b.status}</span></div>) : <p className="text-sm text-ink-soft">No bookings yet.</p>}</div>
  </div>
}
