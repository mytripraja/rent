import { useState, useEffect, useRef } from 'react'
import { getProperties, getActivePropertyId, setActivePropertyId } from '../../services/configService'
import { Building2, ChevronDown, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'

export default function PropertySwitcher() {
  const { user } = useAuth()
  const toast = useToast()
  const [properties, setProperties] = useState([])
  const [activeId, setActiveId] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    async function load() {
      const props = await getProperties()
      setProperties(props)
      const current = getActivePropertyId()
      if (current && props.some(p => p.id === current)) {
        setActiveId(current)
      } else if (props.length > 0) {
        setActiveId(props[0].id)
        setActivePropertyId(props[0].id)
      }
    }
    load()

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function switchProperty(id) {
    setActivePropertyId(id)
    setActiveId(id)
    setIsOpen(false)
    window.location.reload() // Quick reload to apply new context
  }

  function handleAddProperty() {
    toast.info('Multi-property addition coming soon! (Requires full Firestore scoping)')
  }

  const activeProp = properties.find(p => p.id === activeId) || { name: 'My Apartment' }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 bg-paper/10 hover:bg-paper/20 transition px-2 py-1 rounded-md text-sm font-medium"
      >
        <Building2 size={16} />
        <span className="hidden sm:inline">{activeProp.name}</span>
        <ChevronDown size={14} className="opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-paper rounded-xl shadow-lg border border-brass/20 overflow-hidden z-50">
          <div className="py-1">
            {properties.map(p => (
              <button
                key={p.id}
                onClick={() => switchProperty(p.id)}
                className={`w-full text-left px-4 py-2 text-sm ${activeId === p.id ? 'bg-brand/10 text-brand font-medium' : 'text-ink hover:bg-paper-raised'}`}
              >
                {p.name}
              </button>
            ))}
            
            {user?.role === 'admin' && (
              <div className="border-t border-brass/10 mt-1 pt-1">
                <button
                  onClick={handleAddProperty}
                  className="w-full text-left px-4 py-2 text-sm text-ink-soft hover:bg-paper-raised flex items-center gap-2"
                >
                  <Plus size={14} />
                  Add Property
                </button>
              </div>
            )}
          </div>
          {/* Note: Full multi-property support requires prefixing all Firestore queries with the property ID */}
        </div>
      )}
    </div>
  )
}
