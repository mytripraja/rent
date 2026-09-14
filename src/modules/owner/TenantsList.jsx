import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, ChevronRight, Users, Home, Clock3, CircleCheck } from 'lucide-react'
import { listHouses, listPastTenants } from '../../services/houseService'
import { listRentHistory, countMonthsPending } from '../../services/rentService'
import { Skeleton } from '../shared/ui/Skeleton'

const FILTERS = [
  { id: 'current', label: 'Current', icon: Home },
  { id: 'pending', label: 'Rent pending', icon: Clock3 },
  { id: 'old', label: 'Past', icon: Clock3 },
  { id: 'all', label: 'All', icon: Users },
]

export default function TenantsList({ onSelectHouse }) {
  const [filter, setFilter] = useState('current')
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState([])
  const [old, setOld] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const houses = await listHouses()
      const occupied = houses.filter((h) => h.status === 'occupied')
      setCurrent(occupied)

      // History is loaded per house; a history/index problem should not hide current tenants.
      let pastTenants = []
      try { pastTenants = await listPastTenants() } catch (historyError) { console.warn('Tenant history unavailable:', historyError) }
      setOld(pastTenants)

      const pendingList = []
      const paymentsList = await Promise.all(occupied.map((h) => listRentHistory(h.id)))
      occupied.forEach((h, index) => {
        const monthsPending = countMonthsPending(paymentsList[index])
        if (monthsPending > 0) pendingList.push({ ...h, monthsPending })
      })
      setPending(pendingList)
    } catch (err) {
      console.error(err)
      setError(err)
    } finally { setLoading(false) }
  }

  const listToShow = useMemo(() => {
    const base = filter === 'current' ? current : filter === 'old' ? old : filter === 'pending' ? pending : [...current, ...old]
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((t) => [t.tenantName, t.name, t.internalDoorNumber, t.phone, t.houseId].filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
  }, [filter, current, old, pending, query])

  const activeLabel = FILTERS.find(f => f.id === filter)?.label || 'Current'

  return (
    <div className="space-y-4 pb-3">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Tenants</h2>
            <p className="text-sm text-ink-soft mt-0.5">{current.length} current · {old.length} past · {pending.length} pending</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-soft bg-paper-raised border border-[var(--rm-border)] rounded-full px-3 py-1.5">
            <Users size={14} /> {current.length + old.length} records
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tenant, house or phone..."
          aria-label="Search tenants"
          className="w-full rounded-2xl border bg-paper-raised pl-10 pr-4 py-3 text-sm shadow-sm"
        />
      </div>

      {/* Desktop: compact segmented filter. Mobile: one native-sized control, so there is no horizontal overflow/scroll line. */}
      <div className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-paper-raised border border-[var(--rm-border)] w-fit shadow-sm">
        {FILTERS.map((f) => {
          const active = filter === f.id
          return <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3.5 py-2 rounded-xl text-sm font-medium transition ${active ? 'bg-brand text-white shadow-sm' : 'text-ink-soft hover:text-ink hover:bg-paper'}`}>
            {f.label}
            <span className={`ml-1.5 text-[11px] ${active ? 'text-white/75' : 'text-ink-soft'}`}>{f.id === 'current' ? current.length : f.id === 'old' ? old.length : f.id === 'pending' ? pending.length : current.length + old.length}</span>
          </button>
        })}
      </div>

      <div className="md:hidden grid grid-cols-[1fr_auto] gap-2">
        <label className="sr-only" htmlFor="tenant-filter">Tenant view</label>
        <div className="relative">
          <SlidersHorizontal size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand pointer-events-none" />
          <select id="tenant-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full appearance-none rounded-2xl pl-10 pr-8 py-3 text-sm font-semibold border bg-paper-raised">
            {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label} · {f.id === 'current' ? current.length : f.id === 'old' ? old.length : f.id === 'pending' ? pending.length : current.length + old.length}</option>)}
          </select>
        </div>
        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised px-3.5 py-3 text-xs font-semibold text-ink-soft flex items-center gap-1.5">
          <CircleCheck size={15} className="text-brand" /> {activeLabel}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-stamp-red mb-2">Failed to load tenants.</p>
          <button onClick={load} className="text-xs bg-cover text-paper px-3 py-1.5 rounded-full">Retry</button>
        </div>
      )}

      <div className="space-y-2.5">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <motion.div key={`skeleton-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }} className="w-full bg-paper-raised rounded-2xl border border-[var(--rm-border)] shadow-sm p-3.5 flex items-center gap-3">
            <Skeleton variant="circle" className="w-11 h-11 shrink-0" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
          </motion.div>
        ))}

        {!loading && !error && listToShow.map((t, i) => (
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.25 }} key={t.houseId ? `${t.houseId}-${t.id || 'current'}` : t.id} onClick={() => onSelectHouse(t.houseId || t.id)} className="w-full bg-paper-raised rounded-2xl border border-[var(--rm-border)] shadow-sm p-3.5 flex items-center gap-3 text-left hover:shadow-md hover:-translate-y-0.5 transition group">
            <div className="w-11 h-11 rounded-xl bg-[var(--rm-surface-soft)] overflow-hidden flex items-center justify-center text-sm font-bold text-brand shrink-0">
              {t.tenantPhotoUrl || t.photoUrl ? <img src={t.tenantPhotoUrl || t.photoUrl} alt="" className="w-full h-full object-cover" /> : (t.tenantName || t.name || '?')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink truncate">{t.tenantName || t.name}</p>
              <p className="text-xs text-ink-soft mt-0.5 truncate">
                {t.internalDoorNumber ? `House ${t.internalDoorNumber}` : 'Past tenant'}
                {filter === 'old' && t.movedOutAt && ` · Moved out ${new Date(t.movedOutAt).toLocaleDateString()}`}
              </p>
            </div>
            {filter === 'pending' && <span className="text-[11px] bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full font-semibold shrink-0">{t.monthsPending} mo</span>}
            <ChevronRight size={18} className="text-ink-soft/60 group-hover:text-brand transition shrink-0" />
          </motion.button>
        ))}
        {!loading && !error && listToShow.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--rm-border-strong)] bg-paper-raised p-8 text-center">
            <div className="mx-auto w-11 h-11 rounded-xl bg-[var(--rm-surface-soft)] text-brand flex items-center justify-center mb-3"><Users size={20} /></div>
            <p className="text-sm font-semibold text-ink">No tenants found</p>
            <p className="text-xs text-ink-soft mt-1">Try another view or search term.</p>
          </div>
        )}
      </div>
    </div>
  )
}
