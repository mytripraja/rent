import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, DoorOpen, Users, CheckCircle2, PenSquare, Zap, ZapOff,
  Bell, MessageSquareWarning, Phone, FileText, MessagesSquare, MoreHorizontal, LogOut, HelpCircle,
} from 'lucide-react'
import OwnerHome from './OwnerHome'
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

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'houses', label: 'Houses', icon: DoorOpen },
  { id: 'tenants', label: 'Tenants', icon: Users },
  { id: 'approvals', label: 'Rent Approvals', icon: CheckCircle2 },
  { id: 'manualEntry', label: 'Manual Entry', icon: PenSquare },
  { id: 'eb', label: 'EB Bill', icon: Zap },
  { id: 'ebApprovals', label: 'EB Approvals', icon: ZapOff },
  { id: 'notices', label: 'Notices', icon: Bell },
  { id: 'complaints', label: 'Complaints', icon: MessageSquareWarning },
  { id: 'contacts', label: 'Service Contacts', icon: Phone },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'community', label: 'Community', icon: MessagesSquare },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('home')
  const [replayTour, setReplayTour] = useState(false)
  const [searchHouseId, setSearchHouseId] = useState(null)

  function handleSearchSelect(houseId) {
    setSearchHouseId(houseId)
    setTab('tenants')
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Cover band — the passbook-cover header */}
      <header className="bg-cover text-paper px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brass/30 border border-brass overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0">
            {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" /> : user?.name?.[0]}
          </div>
          <div>
            <h1 className="font-display text-lg leading-tight">Rental Manager</h1>
            <p className="text-xs text-brass-light">{user?.name}{user?.role === 'admin' ? ' · Super Admin' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SearchBar onSelectHouse={handleSearchSelect} />
          <button onClick={() => setReplayTour(true)} className="text-brass-light hover:text-paper" title="Help">
            <HelpCircle size={18} />
          </button>
          <button onClick={logout} className="text-brass-light hover:text-paper" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <nav className="bg-paper-raised border-b border-brass/25 px-4 sm:px-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center gap-1.5 text-sm px-3.5 py-3 border-b-2 whitespace-nowrap transition ${
              tab === t.id
                ? 'border-brass text-cover font-semibold'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-4 sm:p-6 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'home' && <OwnerHome onNavigate={setTab} />}
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
          </motion.div>
        </AnimatePresence>
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
