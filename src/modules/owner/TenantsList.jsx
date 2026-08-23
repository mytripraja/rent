import { useEffect, useState } from 'react'
import { listHouses, listPastTenants } from '../../services/houseService'
import { listRentHistory, countMonthsPending } from '../../services/rentService'

const FILTERS = [
  { id: 'all', label: 'All Tenants' },
  { id: 'current', label: 'Current' },
  { id: 'old', label: 'Old' },
  { id: 'pending', label: 'Rent Pending' },
]

export default function TenantsList({ onSelectHouse }) {
  const [filter, setFilter] = useState('current')
  const [current, setCurrent] = useState([])
  const [old, setOld] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const houses = await listHouses()
    const occupied = houses.filter((h) => h.status === 'occupied')
    setCurrent(occupied)

    const pastTenants = await listPastTenants()
    setOld(pastTenants)

    const pendingList = []
    for (const h of occupied) {
      const payments = await listRentHistory(h.id)
      const monthsPending = countMonthsPending(payments)
      if (monthsPending > 0) pendingList.push({ ...h, monthsPending })
    }
    setPending(pendingList)
    setLoading(false)
  }

  const listToShow =
    filter === 'current' ? current
    : filter === 'old' ? old
    : filter === 'pending' ? pending
    : [...current, ...old]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Tenants</h2>
        <p className="text-sm text-ink-soft">{current.length} current · {old.length} past · {pending.length} rent pending</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 text-sm px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${
              filter === f.id ? 'bg-brand text-white' : 'bg-paper-raised text-ink-soft border border-brass/25'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-soft py-6 text-center">Loading…</p>}

      <div className="space-y-2">
        {!loading && listToShow.map((t) => (
          <button
            key={t.houseId ? `${t.houseId}-${t.id}` : t.id}
            onClick={() => onSelectHouse(t.houseId || t.id)}
            className="w-full bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-3 flex items-center gap-3 text-left hover:shadow-md transition"
          >
            <div className="w-10 h-10 rounded-full bg-paper overflow-hidden flex items-center justify-center text-sm text-ink-soft shrink-0">
              {t.tenantPhotoUrl || t.photoUrl
                ? <img src={t.tenantPhotoUrl || t.photoUrl} alt="" className="w-full h-full object-cover" />
                : (t.tenantName || t.name || '?')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{t.tenantName || t.name}</p>
              <p className="text-xs text-ink-soft">
                {t.internalDoorNumber ? `House ${t.internalDoorNumber}` : 'Past tenant'}
                {filter === 'old' && t.movedOutAt && ` · Moved out ${new Date(t.movedOutAt).toLocaleDateString()}`}
              </p>
            </div>
            {filter === 'pending' && (
              <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium shrink-0">
                {t.monthsPending} mo pending
              </span>
            )}
          </button>
        ))}
        {!loading && listToShow.length === 0 && (
          <p className="text-sm text-ink-soft py-8 text-center">Nobody here.</p>
        )}
      </div>
    </div>
  )
}
