import { useEffect, useRef, useState } from 'react'
import { getProperties, getActivePropertyId, setActivePropertyId } from '../../services/configService'
import { Building2, ChevronDown } from 'lucide-react'

export default function PropertySwitcher() {
  const [properties, setProperties] = useState([])
  const [activeId, setActiveId] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    let mounted = true
    getProperties().then(props => {
      if (!mounted) return
      setProperties(props)
      const saved = getActivePropertyId()
      const id = saved && props.some(p => p.id === saved) ? saved : props[0]?.id || ''
      setActiveId(id)
      if (id) setActivePropertyId(id)
    }).catch(() => {})
    const close = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => { mounted = false; document.removeEventListener('mousedown', close) }
  }, [])

  const active = properties.find(p => p.id === activeId) || { name: 'My property' }
  const canSwitch = properties.length > 1

  function switchProperty(id) {
    setActivePropertyId(id)
    setActiveId(id)
    setIsOpen(false)
    window.location.reload()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => canSwitch && setIsOpen(v => !v)} disabled={!canSwitch} className={`flex items-center gap-1.5 bg-paper/10 px-2 py-1 rounded-md text-sm font-medium ${canSwitch ? 'hover:bg-paper/20 transition' : 'cursor-default opacity-90'}`} aria-label="Current property">
        <Building2 size={16} />
        <span className="hidden sm:inline max-w-36 truncate">{active.name}</span>
        {canSwitch && <ChevronDown size={14} className="opacity-70" />}
      </button>
      {isOpen && <div className="absolute right-0 mt-2 w-52 bg-paper rounded-xl shadow-lg border border-brass/20 overflow-hidden z-50"><div className="px-3 py-2 text-[11px] uppercase tracking-wider text-ink-soft border-b border-brass/10">Properties</div>{properties.map(p => <button key={p.id} onClick={() => switchProperty(p.id)} className={`w-full text-left px-4 py-2.5 text-sm ${activeId === p.id ? 'bg-brand/10 text-brand font-medium' : 'text-ink hover:bg-paper-raised'}`}>{p.name}</button>)}</div>}
    </div>
  )
}
