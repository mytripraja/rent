import { useState } from 'react'
import HouseManager from './HouseManager'
import RentApprovalQueue from './RentApprovalQueue'
import EBBillCreator from './EBBillCreator'
import EBApprovalQueue from './EBApprovalQueue'
import NoticeManager from './NoticeManager'
import ComplaintInbox from './ComplaintInbox'
import ServiceContactsManager from './ServiceContactsManager'
import RentRevision from './RentRevision'
import ManualEntryForTenant from './ManualEntryForTenant'
import DocumentVerification from './DocumentVerification'
import CommunityBoard from '../shared/CommunityBoard'
import PropertySetup from './PropertySetup'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { id: 'houses', label: 'Houses' },
  { id: 'approvals', label: 'Rent Approvals' },
  { id: 'manualEntry', label: 'Manual Entry' },
  { id: 'rentRevision', label: 'Rent Revision' },
  { id: 'eb', label: 'EB Bill' },
  { id: 'ebApprovals', label: 'EB Approvals' },
  { id: 'notices', label: 'Notices' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'contacts', label: 'Service Contacts' },
  { id: 'documents', label: 'Documents' },
  { id: 'community', label: 'Community' },
  { id: 'setup', label: 'Setup' },
]

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('houses')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-slate-800 text-base sm:text-lg">Owner Dashboard</h1>
          <p className="text-xs text-slate-400">{user?.name}</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700 shrink-0">Log out</button>
      </header>

      <nav className="px-4 sm:px-6 pt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 text-sm px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              tab === t.id ? 'bg-brand text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-4 sm:p-6">        {tab === 'houses' && <HouseManager />}
        {tab === 'approvals' && <RentApprovalQueue />}
        {tab === 'eb' && <EBBillCreator />}
        {tab === 'ebApprovals' && <EBApprovalQueue />}
        {tab === 'notices' && <NoticeManager />}
        {tab === 'complaints' && <ComplaintInbox />}
        {tab === 'contacts' && <ServiceContactsManager />}
        {tab === 'manualEntry' && <ManualEntryForTenant />}
        {tab === 'rentRevision' && <RentRevision />}
        {tab === 'documents' && <DocumentVerification />}
        {tab === 'community' && <CommunityBoard user={user} canModerate />}
        {tab === 'setup' && <PropertySetup />}
      </main>
    </div>
  )
}
