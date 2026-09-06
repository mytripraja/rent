import React, { useState, Suspense } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, DoorOpen, Users, CheckCircle2, PenSquare, Zap, ZapOff,
  Bell, MessageSquareWarning, Phone, FileText, MessagesSquare, MoreHorizontal, LogOut, HelpCircle,
  IndianRupee, BarChart, Droplets,
} from 'lucide-react'

const OwnerHome = React.lazy(() => import('./OwnerHome'))
const HouseManager = React.lazy(() => import('./HouseManager'))
const TenantsSection = React.lazy(() => import('./TenantsSection'))
const RentApprovalQueue = React.lazy(() => import('./RentApprovalQueue'))
const EBBillCreator = React.lazy(() => import('./EBBillCreator'))
const EBApprovalQueue = React.lazy(() => import('./EBApprovalQueue'))
const WaterBillCreator = React.lazy(() => import('./WaterBillCreator'))
const WaterApprovalQueue = React.lazy(() => import('./WaterApprovalQueue'))
const NoticeManager = React.lazy(() => import('./NoticeManager'))
const ComplaintInbox = React.lazy(() => import('./ComplaintInbox'))
const ServiceContactsManager = React.lazy(() => import('./ServiceContactsManager'))
const ManualEntryForTenant = React.lazy(() => import('./ManualEntryForTenant'))
const PaymentReminders = React.lazy(() => import('./PaymentReminders'))
const MonthlyReport = React.lazy(() => import('./MonthlyReport'))
const DocumentVerification = React.lazy(() => import('./DocumentVerification'))
const ExpenseTracker = React.lazy(() => import('./ExpenseTracker'))
const CommunityBoard = React.lazy(() => import('../shared/CommunityBoard'))
const AnalyticsDashboard = React.lazy(() => import('./AnalyticsDashboard'))
const PaymentCalendar = React.lazy(() => import('./PaymentCalendar'))
const MoreMenu = React.lazy(() => import('./MoreMenu'))
import LoadingScreen from '../shared/LoadingScreen'
import SearchBar from '../shared/SearchBar'
import OnboardingTour from '../shared/OnboardingTour'
import IconButton from '../shared/ui/IconButton'
import ThemeToggle from '../shared/ui/ThemeToggle'
import NotificationBell from '../shared/ui/NotificationBell'
import LanguageSwitcher from '../shared/ui/LanguageSwitcher'
import PropertySwitcher from './PropertySwitcher'
import { OWNER_TOUR_STEPS } from './ownerTourSteps'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { id: 'home', route: 'home', label: 'Home', icon: Home },
  { id: 'houses', route: 'houses', label: 'Houses', icon: DoorOpen },
  { id: 'tenants', route: 'tenants', label: 'Tenants', icon: Users },
  { id: 'calendar', route: 'calendar', label: 'Calendar', icon: BarChart },
  { id: 'approvals', route: 'approvals', label: 'Rent Approvals', icon: CheckCircle2 },
  { id: 'manualEntry', route: 'manual-entry', label: 'Manual Entry', icon: PenSquare },
  { id: 'eb', route: 'eb-bill', label: 'EB Bill', icon: Zap },
  { id: 'ebApprovals', route: 'eb-approvals', label: 'EB Approvals', icon: ZapOff },
  { id: 'water', route: 'water-bill', label: 'Water Bill', icon: Droplets },
  { id: 'waterApprovals', route: 'water-approvals', label: 'Water Approvals', icon: Droplets },
  { id: 'notices', route: 'notices', label: 'Notices', icon: Bell },
  { id: 'complaints', route: 'complaints', label: 'Complaints', icon: MessageSquareWarning },
  { id: 'contacts', route: 'contacts', label: 'Service Contacts', icon: Phone },
  { id: 'reminders', route: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'documents', route: 'documents', label: 'Documents', icon: FileText },
  { id: 'reports', route: 'reports', label: 'Reports', icon: BarChart },
  { id: 'analytics', route: 'analytics', label: 'Analytics', icon: BarChart },
  { id: 'expenses', route: 'expenses', label: 'Expenses', icon: IndianRupee },
  { id: 'community', route: 'community', label: 'Community', icon: MessagesSquare },
  { id: 'more', route: 'more', label: 'More', icon: MoreHorizontal },
]

// The 5 things you reach for most often, pinned to a bottom nav on mobile —
// full context switching still lives in the top scrollable tab strip.
const MOBILE_PRIMARY = ['home', 'houses', 'tenants', 'approvals', 'more']

export default function OwnerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const pathSegment = location.pathname.split('/owner/')[1] || 'home'
  const activeTabObj = TABS.find(t => t.route === pathSegment) || TABS[0]
  const tab = activeTabObj.id

  const [replayTour, setReplayTour] = useState(false)
  const [searchHouseId, setSearchHouseId] = useState(null)

  function handleSearchSelect(houseId) {
    setSearchHouseId(houseId)
    navigate('/owner/tenants')
  }

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Cover band — the passbook-cover header */}
      <header className="bg-cover text-paper px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brass/30 border border-brass overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden="true">
            {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" /> : user?.name?.[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg leading-tight">Rental Manager</h1>
              <PropertySwitcher />
            </div>
            <p className="text-xs text-brass-light">{user?.name}{user?.role === 'admin' ? ' · Super Admin' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SearchBar onSelectHouse={handleSearchSelect} />
          <LanguageSwitcher />
          <NotificationBell userId={user?.uid} />
          <ThemeToggle />
          <IconButton icon={HelpCircle} label="Replay onboarding tour" onClick={() => setReplayTour(true)} />
          <IconButton icon={LogOut} label="Log out" onClick={logout} />
        </div>
      </header>

      <nav className="bg-paper-raised border-b border-brass/25 px-4 sm:px-6 flex gap-1 overflow-x-auto" role="tablist" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="dashboard-panel"
            onClick={() => navigate(`/owner/${t.route}`)}
            className={`shrink-0 flex items-center gap-1.5 text-sm px-3.5 py-3 border-b-2 whitespace-nowrap transition ${
              tab === t.id
                ? 'border-brass text-cover font-semibold'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <t.icon size={15} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>

      <main id="main-content" tabIndex={-1} className="p-4 sm:p-6 pb-24 sm:pb-6 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            id="dashboard-panel"
            role="tabpanel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="home" element={<OwnerHome onNavigate={(t) => navigate(`/owner/${TABS.find(x => x.id === t)?.route || 'home'}`)} />} />
                <Route path="houses" element={<HouseManager />} />
                <Route path="tenants" element={<TenantsSection openHouseId={searchHouseId} onOpenHouseHandled={() => setSearchHouseId(null)} />} />
                <Route path="calendar" element={<PaymentCalendar />} />
                <Route path="approvals" element={<RentApprovalQueue />} />
                <Route path="eb-bill" element={<EBBillCreator />} />
                <Route path="eb-approvals" element={<EBApprovalQueue />} />
                <Route path="water-bill" element={<WaterBillCreator />} />
                <Route path="water-approvals" element={<WaterApprovalQueue />} />
                <Route path="notices" element={<NoticeManager />} />
                <Route path="complaints" element={<ComplaintInbox />} />
                <Route path="contacts" element={<ServiceContactsManager />} />
                <Route path="manual-entry" element={<ManualEntryForTenant />} />
                <Route path="documents" element={<DocumentVerification />} />
                <Route path="expenses" element={<ExpenseTracker />} />
                <Route path="reminders" element={<PaymentReminders />} />
                <Route path="reports" element={<MonthlyReport />} />
                <Route path="analytics" element={<AnalyticsDashboard />} />
                <Route path="community" element={<CommunityBoard user={user} canModerate />} />
                <Route path="more" element={<MoreMenu />} />
                <Route path="*" element={<OwnerHome onNavigate={(t) => navigate(`/owner/${TABS.find(x => x.id === t)?.route || 'home'}`)} />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav — the 5 most-reached-for sections, thumb-friendly */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 bg-paper-raised border-t border-brass/25 flex items-stretch z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        {TABS.filter((t) => MOBILE_PRIMARY.includes(t.id)).map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/owner/${t.route}`)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] ${
              tab === t.id ? 'text-cover font-semibold' : 'text-ink-soft'
            }`}
          >
            <t.icon size={18} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>

      <OnboardingTour
        steps={OWNER_TOUR_STEPS}
        storageKey={`tour_seen_owner_${user?.uid}`}
        forceOpen={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />
    </div>
  )
}
