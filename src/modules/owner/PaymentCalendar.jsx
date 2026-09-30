import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { listHouses } from '../../services/houseService'
import { resolveMonthStatus, listRentPaymentsForHouses } from '../../services/rentService'
import { useToast } from '../shared/ui/Toast'
import LoadingScreen from '../shared/LoadingScreen'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STATUS = {
  paid: { label: 'Paid', dot: 'bg-stamp-green' },
  waiting_approval: { label: 'Waiting', dot: 'bg-stamp-amber' },
  not_paid: { label: 'Not paid', dot: 'bg-stamp-red' },
  vacant: { label: 'Vacant', dot: 'bg-black/10' },
}

export default function PaymentCalendar() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [houses, setHouses] = useState([])
  const [rents, setRents] = useState([])
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [query, setQuery] = useState('')
  const [selectedHouseId, setSelectedHouseId] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      const h = await listHouses()
      setHouses(h)
      setRents(await listRentPaymentsForHouses(h.map(x => x.id)))
    } catch (error) {
      console.error(error)
      toast.error('Failed to load calendar data')
    } finally { setLoading(false) }
  }

  const monthStr = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`
  const filteredHouses = useMemo(() => houses.filter(h => {
    if (selectedHouseId !== 'all' && h.id !== selectedHouseId) return false
    const q = query.trim().toLowerCase()
    return !q || `${h.internalDoorNumber || ''} ${h.tenantName || ''}`.toLowerCase().includes(q)
  }), [houses, selectedHouseId, query])

  const cells = useMemo(() => filteredHouses.map(h => {
    const houseRents = rents.filter(r => r.houseId === h.id)
    const monthRents = houseRents.filter(r => r.month === monthStr)
    let status = resolveMonthStatus(houseRents, monthStr)
    if (h.status === 'vacant' && monthRents.length === 0) status = 'vacant'
    return { house: h, status, rents: monthRents }
  }), [filteredHouses, rents, monthStr])

  const summary = useMemo(() => cells.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a }, {}), [cells])

  function shiftMonth(delta) { setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+delta, 1)); setSelected(null) }

  if (loading) return <LoadingScreen />

  return <div className="space-y-4 animate-in fade-in duration-200">
    <section className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[.14em] font-bold text-ink-soft">Rent calendar</p><h2 className="font-display text-2xl font-extrabold text-ink mt-1">{cursor.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h2><p className="text-sm text-ink-soft mt-1">One screen for every house and every month's rent status.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={()=>setCursor(new Date())} className="rounded-xl border border-[var(--rm-border)] px-3 py-2 text-xs font-bold text-brand">Today</button><button type="button" onClick={()=>shiftMonth(-1)} className="w-10 h-10 rounded-xl border border-[var(--rm-border)] flex items-center justify-center" aria-label="Previous month"><ChevronLeft size={18}/></button><button type="button" onClick={()=>shiftMonth(1)} className="w-10 h-10 rounded-xl border border-[var(--rm-border)] flex items-center justify-center" aria-label="Next month"><ChevronRight size={18}/></button></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        <label className="relative"><Search size={16} className="absolute left-3 top-3.5 text-ink-soft"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search house or tenant" className="w-full pl-9"/></label>
        <select value={selectedHouseId} onChange={e=>setSelectedHouseId(e.target.value)} className="w-full"><option value="all">All houses</option>{houses.map(h=><option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName || 'Vacant'}</option>)}</select>
      </div>
    </section>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{Object.entries(STATUS).map(([key,v])=><div key={key} className="rounded-xl border border-[var(--rm-border)] bg-paper p-3"><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${v.dot}`}/><span className="text-xs font-semibold text-ink-soft">{v.label}</span></div><p className="text-xl font-bold text-ink mt-1">{summary[key] || 0}</p></div>)}</div>

    <section className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--rm-border)] bg-paper-raised">
      <table className="w-full text-sm border-collapse min-w-[760px]"><thead><tr className="border-b border-[var(--rm-border)]"><th className="text-left p-3 text-xs uppercase tracking-wide text-ink-soft">House</th><th className="text-left p-3 text-xs uppercase tracking-wide text-ink-soft">Resident</th><th className="text-center p-3 text-xs uppercase tracking-wide text-ink-soft">Status</th><th className="text-right p-3 text-xs uppercase tracking-wide text-ink-soft">Payment</th><th className="text-right p-3 text-xs uppercase tracking-wide text-ink-soft">Open</th></tr></thead><tbody>{cells.map(c=>{const meta=STATUS[c.status]||STATUS.not_paid; const total=c.rents.reduce((n,r)=>n+Number(r.amount||0),0); return <tr key={c.house.id} className="border-b border-[var(--rm-border)] last:border-0 hover:bg-brand/5"><td className="p-3 font-bold text-ink">{c.house.internalDoorNumber}</td><td className="p-3 text-ink-soft">{c.house.tenantName || 'Vacant'}</td><td className="p-3 text-center"><span className="inline-flex items-center gap-2 rounded-full border border-[var(--rm-border)] px-2.5 py-1 text-xs font-semibold"><span className={`w-2 h-2 rounded-full ${meta.dot}`}/>{meta.label}</span></td><td className="p-3 text-right font-semibold">{c.rents.length ? `₹${total.toLocaleString('en-IN')}` : '—'}</td><td className="p-3 text-right"><button type="button" onClick={()=>setSelected(c)} className="text-xs font-bold text-brand">View</button></td></tr>})}</tbody></table>{cells.length===0&&<p className="p-10 text-center text-sm text-ink-soft">No houses match this filter.</p>}</section>

    <section className="md:hidden space-y-2">{cells.map(c=>{const meta=STATUS[c.status]||STATUS.not_paid; const total=c.rents.reduce((n,r)=>n+Number(r.amount||0),0); return <button key={c.house.id} type="button" onClick={()=>setSelected(c)} className="w-full text-left rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-ink">{c.house.internalDoorNumber}</p><p className="text-xs text-ink-soft mt-1">{c.house.tenantName || 'Vacant'}</p></div><span className="inline-flex items-center gap-1.5 text-xs font-semibold"><span className={`w-2 h-2 rounded-full ${meta.dot}`}/>{meta.label}</span></div><div className="flex justify-between mt-3 text-xs text-ink-soft"><span>{c.rents.length ? `${c.rents.length} payment${c.rents.length===1?'':'s'}` : 'No payment'}</span><span className="font-bold text-ink">{c.rents.length ? `₹${total.toLocaleString('en-IN')}` : '—'}</span></div></button>})}{cells.length===0&&<p className="rounded-2xl border border-dashed border-[var(--rm-border)] p-8 text-center text-sm text-ink-soft">No houses match this filter.</p>}</section>

    {selected && <div className="fixed inset-0 z-[80] bg-black/45 p-4 grid place-items-center" onMouseDown={e=>e.currentTarget===e.target&&setSelected(null)}><div className="w-full max-w-md rounded-2xl bg-paper-raised border border-[var(--rm-border)] shadow-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-ink-soft">{selected.house.internalDoorNumber}</p><h3 className="font-display text-xl font-bold text-ink mt-1">{selected.house.tenantName || 'Vacant'}</h3></div><button onClick={()=>setSelected(null)} className="w-9 h-9 rounded-lg border border-[var(--rm-border)]">×</button></div><p className="text-sm text-ink-soft mt-2">{cursor.toLocaleDateString('en-IN',{month:'long',year:'numeric'})} · {(STATUS[selected.status]||STATUS.not_paid).label}</p><div className="space-y-2 mt-4">{selected.rents.map(r=><div key={r.id} className="rounded-xl border border-[var(--rm-border)] bg-paper p-3"><div className="flex justify-between gap-3"><span className="font-bold">₹{Number(r.amount||0).toLocaleString('en-IN')}</span><span className="text-xs text-ink-soft">{r.mode || '—'}</span></div><p className="text-xs text-ink-soft mt-1">{r.status || '—'} {r.applicationNumber ? `· ${r.applicationNumber}` : ''}</p></div>)}{selected.rents.length===0&&<p className="text-sm text-ink-soft">No payment recorded for this month.</p>}</div></div></div>}
  </div>
}
