import { useEffect, useRef, useState } from 'react'
import { listHouses } from '../../services/houseService'

export default function SearchBar({ onSelectHouse }) {
  const [houses, setHouses] = useState([])
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    listHouses().then(setHouses)
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const results = term.trim()
    ? houses.filter((h) => {
        const q = term.trim().toLowerCase()
        return (
          h.internalDoorNumber?.toLowerCase().includes(q) ||
          h.tenantName?.toLowerCase().includes(q) ||
          h.tenantPhone?.includes(q)
        )
      }).slice(0, 8)
    : []

  function select(house) {
    onSelectHouse(house.id)
    setTerm('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs">
      <label htmlFor="global-search" className="sr-only">Search tenants, houses, or phone numbers</label>
      <input
        id="global-search"
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search tenant, house, phone…"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        className="w-full border border-brass/30 rounded-lg pl-8 pr-3 py-1.5 text-sm bg-paper-raised text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft text-sm" aria-hidden="true">⌕</span>

      {open && results.length > 0 && (
        <div id="global-search-results" role="listbox" className="absolute mt-1 w-full bg-paper-raised border border-brass/25 rounded-lg shadow-lg z-50 overflow-hidden">
          {results.map((h) => (
            <button
              key={h.id}
              role="option"
              aria-selected="false"
              onClick={() => select(h)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-paper flex items-center justify-between"
            >
              <span className="text-ink">{h.tenantName || 'Vacant'} · {h.internalDoorNumber}</span>
              <span className="text-xs text-ink-soft">{h.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
