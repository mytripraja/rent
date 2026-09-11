import React, { useState, Suspense } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, DoorOpen, Users, CheckCircle2, PenSquare, Zap, ZapOff,
  Bell, MessageSquareWarning, Phone, FileText, MessagesSquare, MoreHorizontal, LogOut, HelpCircle,
  IndianRupee, BarChart, Droplets, Menu, X, CalendarDays,
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
  { id: 'home', route: 'home', label: 'Overview', icon: Home, group: 'Daily' },
  { id: 'houses', route: 'houses', label: 'Houses', icon: DoorOpen, group: 'Daily' },
  { id: 'tenants', route: 'tenants', label: 'Tenants', icon: Users, group: 'Daily' },
  { id: 'approvals', route: 'approvals', label: 'Rent approvals', icon: CheckCircle2, group: 'Money' },
  { id: 'manualEntry', route: 'manual-entry', label: 'Manual payment', icon: PenSquare, group: 'Money' },
  { id: 'eb', route: 'eb-bill', label: 'EB bills', icon: Zap, group: 'Money' },
  { id: 'ebApprovals', route: 'eb-approvals', label: 'EB approvals', icon: ZapOff, group: 'Money' },
  { id: 'water', route: 'water-bill', label: 'Water bills', icon: Droplets, group: 'Money' },
  { id: 'waterApprovals', route: 'water-approvals', label: 'Water approvals', icon: Droplets, group: 'Money' },
  { id: 'expenses', route: 'expenses', label: 'Expenses', icon: IndianRupee, group: 'Money' },
  { id: 'calendar', route: 'calendar', label: 'Payment calendar', icon: CalendarDays, group: 'Operations' },
  { id: 'complaints', route: 'complaints', label: 'Complaints', icon: MessageSquareWarning, group: 'Operations' },
  { id: 'notices', route: 'notices', label: 'Notices', icon: Bell, group: 'Operations' },
  { id: 'reminders', route: 'reminders', label: 'Reminders', icon: Bell, group: 'Operations' },
  { id: 'documents', route: 'documents', label: 'Documents', icon: FileText, group: 'Operations' },
  { id: 'contacts', route: 'contacts', label: 'Service contacts', icon: Phone, group: 'Operations' },
  { id: 'community', route: 'community', label: 'Community', icon: MessagesSquare, group: 'Community' },
  { id: 'reports', route: 'reports', label: 'Reports', icon: BarChart, group: 'Insights' },
  { id: 'analytics', route: 'analytics', label: 'Analytics', icon: BarChart, group: 'Insights' },
  { id: 'more', route: 'more', label: 'More tools', icon: MoreHorizontal, group: 'Admin' },
]

const MOBILE_PRIMARY = ['home', 'houses', 'approvals', 'complaints', 'more']
const GROUPS = ['Daily', 'Money', 'Operations', 'Community', 'Insights', 'Admin']


export default function OwnerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const pathSegment = location.pathname.split('/owner/')[1] || 'home'
  const activeTabObj = TABS.find(t => t.route === pathSegment) || TABS[0]
  const tab = activeTabObj.id

  const [replayTour, setReplayTour] = useState(false)
  const [searchHouseId, setSearchHouseId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleSearchSelect(houseId) {
    setSearchHouseId(houseId)
    navigate('/owner/tenants')
  }

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Cover band — the passbook-cover header */}
      <header className="app-topbar bg-cover text-paper px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="brand-avatar w-9 h-9 rounded-full bg-brass/30 border border-brass overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden="true">
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

      <div className="owner-shell">
        <aside className={`owner-sidebar ${sidebarOpen ? 'owner-sidebar-open' : ''}`} aria-label="Owner navigation">
          <div className="flex items-center justify-between px-4 py-3 lg:hidden">
            <span className="font-semibold">Menu</span>
            <IconButton icon={X} label="Close menu" onClick={() => setSidebarOpen(false)} />
          </div>
          <div className="owner-sidebar-inner">
            {GROUPS.map(group => {
              const items = TABS.filter(t => t.group === group)
              return <div key={group} className="owner-nav-group">
                <p className="owner-nav-label">{group}</p>
                {items.map(item => {
                  const Icon = item.icon
                  const active = tab === item.id
                  return <button key={item.id} onClick={() => { navigate(`/owner/${item.route}`); setSidebarOpen(false) }} className={`owner-nav-item ${active ? 'owner-nav-item-active' : ''}`} aria-current={active ? 'page' : undefined}>
                    <Icon size={17} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                })}
              </div>
            })}
          </div>
        </aside>
        {sidebarOpen && <button aria-label="Close navigation" className="owner-sidebar-backdrop lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <div className="owner-content">
          <div className="lg:hidden flex items-center justify-between mb-4">
            <button onClick={() => setSidebarOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-brass/25 bg-paper-raised px-3 py-2 text-sm font-medium"><Menu size={18} /> Menu</button>
            <span className="text-xs text-ink-soft">{activeTabObj.label}</span>
          </div>
      <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-6">
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
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-paper-raised/95 backdrop-blur border-t border-brass/25 flex z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Primary">
        {TABS.filter(t => MOBILE_PRIMARY.includes(t.id)).map(t => {
          const Icon = t.icon
          return <button key={t.id} onClick={() => navigate(`/owner/${t.route}`)} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] ${tab === t.id ? 'text-cover font-semibold' : 'text-ink-soft'}`}>
            <Icon size={18} aria-hidden="true" />{t.label}
          </button>
        })}
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
