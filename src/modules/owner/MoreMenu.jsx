import { useState } from 'react'
import OwnerProfile from './OwnerProfile'
import RentRevision from './RentRevision'
import PropertySetup from './PropertySetup'
import OwnerManager from './OwnerManager'
import { useAuth } from '../../context/AuthContext'

const ITEMS = [
  { id: 'profile', label: 'My Profile', icon: '👤' },
  { id: 'rentRevision', label: 'Rent Revision', icon: '📈' },
  { id: 'setup', label: 'Property Setup', icon: '🏗️' },
]

export default function MoreMenu() {
  const { user } = useAuth()
  const [view, setView] = useState(null)
  const isAdmin = user?.role === 'admin'

  const items = isAdmin ? [...ITEMS, { id: 'owners', label: 'Owner Management', icon: '🔑' }] : ITEMS

  if (view) {
    return (
      <div className="space-y-4">
        <button onClick={() => setView(null)} className="text-sm text-slate-500 hover:text-slate-700">← Back</button>
        {view === 'profile' && <OwnerProfile />}
        {view === 'rentRevision' && <RentRevision />}
        {view === 'setup' && <PropertySetup />}
        {view === 'owners' && isAdmin && <OwnerManager />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">More Tools</h2>
      <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left hover:shadow-md transition flex items-center gap-3"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-medium text-slate-700">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
