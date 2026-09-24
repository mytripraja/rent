import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProperties, getActivePropertyId, setActivePropertyId } from '../../services/configService'
import { Building2, ChevronDown, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

function allowedProperties(properties, user) {
  if (user?.role === 'admin' || !Array.isArray(user?.propertyAccess) || user.propertyAccess.includes('*')) return properties
  return properties.filter(p => user.propertyAccess.includes(p.id))
}

export default function PropertySwitcher() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [properties, setProperties] = useState([])
  const [activeId, setActiveId] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  async function load() {
    const all = await getProperties()
    const props = allowedProperties(all, user)
    setProperties(props)
    const saved = getActivePropertyId()
    const id = saved && props.some(p => p.id === saved) ? saved : props[0]?.id || ''
    setActiveId(id)
    if (id) setActivePropertyId(id)
  }

  useEffect(() => {
    let mounted = true
    load().catch(() => {})
    const close = event => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false) }
    const changed = event => { if (event.detail?.id) setActiveId(event.detail.id) }
    const created = event => { if (!event.detail?.id) return; setProperties(prev => prev.some(p => p.id === event.detail.id) ? prev.map(p => p.id === event.detail.id ? { ...p, ...event.detail } : p) : [...prev, event.detail]); setActiveId(event.detail.id) }
    document.addEventListener('mousedown', close)
    window.addEventListener('rm:property-changed', changed)
    window.addEventListener('rm:property-created', created)
    return () => { mounted = false; document.removeEventListener('mousedown', close); window.removeEventListener('rm:property-changed', changed); window.removeEventListener('rm:property-created', created) }
  }, [user?.uid, JSON.stringify(user?.propertyAccess)])

  const active = properties.find(p => p.id === activeId) || { name: 'My Apartment' }
  const canSwitch = properties.length >= 1

  function switchProperty(id) {
    setActivePropertyId(id)
    setActiveId(id)
    setIsOpen(false)
    window.dispatchEvent(new CustomEvent('rm:property-changed', { detail: { id } }))
    // Do not hard-reload the app. OwnerDashboard remounts the active screen
    // from this event so the property-scoped data refreshes without the long
    // Vite/Firebase boot/loading screen seen on mobile.
  }

  return <div className="relative min-w-0" ref={dropdownRef}>
    <button onClick={() => canSwitch && setIsOpen(v => !v)} disabled={!canSwitch} className={`flex min-w-0 max-w-[clamp(8rem,38vw,16rem)] items-center gap-2 bg-paper/10 px-2.5 py-2 rounded-xl text-sm font-semibold ${canSwitch ? 'hover:bg-paper/20 transition' : 'cursor-default opacity-90'}`} aria-haspopup={canSwitch ? 'menu' : undefined} aria-expanded={canSwitch ? isOpen : undefined} aria-label={`Current apartment: ${active.name}`}>
      <Building2 size={16} />
      <span className="min-w-0 max-w-[6.5rem] sm:max-w-40 truncate">{active.name}</span>
      {canSwitch && <ChevronDown size={14} className="opacity-70" />}
    </button>
    {isOpen && <div role="menu" className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-paper rounded-2xl shadow-xl border border-brass/20 overflow-hidden z-[80]">
      <div className="px-4 py-3 text-[11px] uppercase tracking-wider text-ink-soft border-b border-brass/10">Switch apartment</div>
      {properties.map(p => <button role="menuitem" key={p.id} onClick={() => switchProperty(p.id)} className={`w-full flex items-center gap-3 text-left px-4 py-3 text-sm ${activeId === p.id ? 'bg-brand/10 text-brand font-bold' : 'text-ink hover:bg-paper-raised'}`}><Building2 size={16}/><span className="flex-1 truncate">{p.name}</span>{activeId === p.id && <Check size={16}/>}</button>)}
      {properties.length === 0 && <p className="p-4 text-sm text-ink-soft">No apartment access has been assigned.</p>}
    </div>}
  </div>
}
