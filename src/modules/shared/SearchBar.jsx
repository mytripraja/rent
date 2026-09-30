import { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { listHouses } from '../../services/houseService'

const MODES = [
  ['all', 'All'],
  ['tenant', 'Tenant'],
  ['ebNumber', 'EB number'],
  ['door', 'Door number'],
  ['govtDoor', 'Government door'],
  ['phone', 'Phone'],
  ['house', 'House'],
]

export default function SearchBar({ onSelectHouse }) {
  const [houses, setHouses] = useState([])
  const [term, setTerm] = useState('')
  const [mode, setMode] = useState('all')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    let active = true
    listHouses().then((rows) => { if (active) setHouses(rows) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const normalize = (value) => String(value ?? '').toLowerCase().trim()
  const q = normalize(term)
  const matchers = {
    tenant: (h) => `${h.tenantName || ''} ${h.tenantPhone || ''}`,
    ebNumber: (h) => h.ebNumber,
    door: (h) => `${h.internalDoorNumber || ''} ${h.id || ''}`,
    govtDoor: (h) => h.govtDoorNumber,
    phone: (h) => h.tenantPhone,
    house: (h) => `${h.internalDoorNumber || ''} ${h.govtDoorNumber || ''} ${h.ebNumber || ''} ${h.id || ''}`,
  }
  const results = q
    ? houses.filter((h) => mode === 'all' ? Object.values(matchers).some(fn => normalize(fn(h)).includes(q)) : normalize(matchers[mode](h)).includes(q)).slice(0, 10)
    : []

  function select(house) {
    onSelectHouse(house.id)
    setTerm('')
    setOpen(false)
  }

  const selectedLabel = MODES.find(([id]) => id === mode)?.[1] || 'All'

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <label htmlFor="global-search" className="sr-only">Search rental manager</label>
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
          <input
            id="global-search"
            value={term}
            onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={`Search ${selectedLabel.toLowerCase()}…`}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            className="w-full border border-brass/30 rounded-lg pl-8 pr-3 py-2 text-sm bg-paper-raised text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <select
          aria-label="Search field"
          value={mode}
          onChange={(e) => { setMode(e.target.value); setOpen(true) }}
          className="h-9 max-w-[132px] border border-brass/30 rounded-lg px-2 text-xs bg-paper-raised text-ink"
          title="Choose what to search"
        >
          {MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <SlidersHorizontal size={15} className="text-ink-soft hidden sm:block" aria-hidden="true" />
      </div>

      {open && results.length > 0 && (
        <div id="global-search-results" role="listbox" className="absolute mt-1 right-0 w-full sm:w-[420px] bg-paper-raised border border-brass/25 rounded-lg shadow-lg z-50 overflow-hidden">
          {results.map((h) => (
            <button
              key={h.id}
              role="option"
              aria-selected="false"
              onClick={() => select(h)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-paper flex items-center justify-between gap-3"
            >
              <span className="min-w-0"><span className="text-ink font-medium block truncate">{h.tenantName || 'Vacant'} · {h.internalDoorNumber || h.id}</span><span className="text-xs text-ink-soft block truncate">EB {h.ebNumber || '—'} · Govt {h.govtDoorNumber || '—'}</span></span>
              <span className="text-xs text-ink-soft shrink-0">{h.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
