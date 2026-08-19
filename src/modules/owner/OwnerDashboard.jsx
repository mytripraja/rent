import { useState } from 'react'
import HouseManager from './HouseManager'
import RentApprovalQueue from './RentApprovalQueue'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { id: 'houses', label: 'Houses' },
  { id: 'approvals', label: 'Rent Approvals' },
]

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('houses')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-slate-800">Owner Dashboard</h1>
          <p className="text-xs text-slate-400">{user?.name}</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">Log out</button>
      </header>

      <nav className="px-6 pt-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-sm px-4 py-2 rounded-lg font-medium ${
              tab === t.id ? 'bg-brand text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {tab === 'houses' && <HouseManager />}
        {tab === 'approvals' && <RentApprovalQueue />}
      </main>
    </div>
  )
}
