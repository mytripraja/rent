import { useState } from 'react'
import HouseManager from './HouseManager'
import TenantsSection from './TenantsSection'
import RentApprovalQueue from './RentApprovalQueue'
import EBBillCreator from './EBBillCreator'
import EBApprovalQueue from './EBApprovalQueue'
import NoticeManager from './NoticeManager'
import ComplaintInbox from './ComplaintInbox'
import ServiceContactsManager from './ServiceContactsManager'
import ManualEntryForTenant from './ManualEntryForTenant'
import DocumentVerification from './DocumentVerification'
import CommunityBoard from '../shared/CommunityBoard'
import MoreMenu from './MoreMenu'
import SearchBar from '../shared/SearchBar'
import OnboardingTour from '../shared/OnboardingTour'
import { OWNER_TOUR_STEPS } from './ownerTourSteps'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

// "Houses" and "Tenants" cover the everyday work; Rent Revision and Property
// Setup moved into the More menu since those only come up a couple times a
// year, not something that should take up a tab every day.
const TABS = [
  { id: 'houses', label: 'Houses' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'approvals', label: 'Rent Approvals' },
  { id: 'manualEntry', label: 'Manual Entry' },
  { id: 'eb', label: 'EB Bill' },
  { id: 'ebApprovals', label: 'EB Approvals' },
  { id: 'notices', label: 'Notices' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'contacts', label: 'Service Contacts' },
  { id: 'documents', label: 'Documents' },
  { id: 'community', label: 'Community' },
  { id: 'more', label: 'More' },
]

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('houses')
  const [replayTour, setReplayTour] = useState(false)
  const [searchHouseId, setSearchHouseId] = useState(null)

  function handleSearchSelect(houseId) {
    setSearchHouseId(houseId)
    setTab('tenants')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center text-sm text-slate-500 shrink-0">
            {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" /> : user?.name?.[0]}
          </div>
          <div>
            <h1 className="font-semibold text-slate-800 text-base sm:text-lg">Owner Dashboard</h1>
            <p className="text-xs text-slate-400">{user?.name}{user?.role === 'admin' ? ' · Super Admin' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SearchBar onSelectHouse={handleSearchSelect} />
          <button onClick={() => setReplayTour(true)} className="text-sm text-brand hover:text-brand-dark whitespace-nowrap">Help</button>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700 whitespace-nowrap">Log out</button>
        </div>
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

      <main className="p-4 sm:p-6">
        {tab === 'houses' && <HouseManager />}
        {tab === 'tenants' && (
          <TenantsSection openHouseId={searchHouseId} onOpenHouseHandled={() => setSearchHouseId(null)} />
        )}
        {tab === 'approvals' && <RentApprovalQueue />}
        {tab === 'eb' && <EBBillCreator />}
        {tab === 'ebApprovals' && <EBApprovalQueue />}
        {tab === 'notices' && <NoticeManager />}
        {tab === 'complaints' && <ComplaintInbox />}
        {tab === 'contacts' && <ServiceContactsManager />}
        {tab === 'manualEntry' && <ManualEntryForTenant />}
        {tab === 'documents' && <DocumentVerification />}
        {tab === 'community' && <CommunityBoard user={user} canModerate />}
        {tab === 'more' && <MoreMenu />}
      </main>

      <OnboardingTour
        steps={OWNER_TOUR_STEPS}
        storageKey={`tour_seen_owner_${user?.uid}`}
        forceOpen={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />
    </div>
  )
}
