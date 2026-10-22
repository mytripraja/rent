import React, { Component, useEffect, useState, Suspense } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, DoorOpen, Users, CheckCircle2, PenSquare, Zap, ZapOff,
  Bell, MessageSquareWarning, Phone, FileText, MessagesSquare, MoreHorizontal, Settings,
  LogOut, IndianRupee, BarChart3, Droplets, CalendarDays,
  Wrench, Megaphone, ReceiptIndianRupee, Building2
} from 'lucide-react'

const OwnerHome = React.lazy(() => import('./OwnerHome'))
const HouseManager = React.lazy(() => import('./HouseManager'))
const PropertySetup = React.lazy(() => import('./PropertySetup'))
const TenantsSection = React.lazy(() => import('./TenantsSection'))
const RentApprovalQueue = React.lazy(() => import('./RentApprovalQueue'))
const EBBillCreator = React.lazy(() => import('./EBBillCreator'))
const EBApprovalQueue = React.lazy(() => import('./EBApprovalQueue'))
const WaterBillCreator = React.lazy(() => import('./WaterBillCreator'))
const WaterApprovalQueue = React.lazy(() => import('./WaterApprovalQueue'))
const NoticeManager = React.lazy(() => import('./NoticeManager'))
const ComplaintInbox = React.lazy(() => import('./ComplaintInbox'))
const MaintenanceManager = React.lazy(() => import('./MaintenanceManager'))
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
const AppSettings = React.lazy(() => import('./AppSettings'))
import LoadingScreen from '../shared/LoadingScreen'
import DadLiteDashboard from './DadLiteDashboard'
import SearchBar from '../shared/SearchBar'
import IconButton from '../shared/ui/IconButton'
import ThemeToggle from '../shared/ui/ThemeToggle'
import UserSettingsModal from '../shared/UserSettingsModal'
import NotificationBell from '../shared/ui/NotificationBell'
import InstallAppPrompt from '../shared/ui/InstallAppPrompt'
import PropertySwitcher from './PropertySwitcher'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { id: 'home', route: 'home', label: 'Dashboard', mobileLabel: 'Home', icon: Home, group: 'Workspace' },
  { id: 'houses', route: 'houses', label: 'Houses', mobileLabel: 'Houses', icon: DoorOpen, group: 'Workspace' },
  { id: 'tenants', route: 'tenants', label: 'Tenants', mobileLabel: 'Tenants', icon: Users, group: 'Workspace' },
  { id: 'approvals', route: 'approvals', label: 'Rent Approvals', mobileLabel: 'Approvals', icon: CheckCircle2, group: 'Finance', badge: true },
  { id: 'manualEntry', route: 'manual-entry', label: 'Manual Payments', icon: PenSquare, group: 'Finance' },
  { id: 'water', route: 'water-bill', label: 'Water Bills', icon: Droplets, group: 'Finance' },
  { id: 'eb', route: 'eb-bill', label: 'EB Bills', icon: Zap, group: 'Finance' },
  { id: 'reports', route: 'reports', label: 'Payment History', icon: ReceiptIndianRupee, group: 'Finance' },
  { id: 'notices', route: 'notices', label: 'Announcements', icon: Megaphone, group: 'Property' },
  { id: 'maintenance', route: 'maintenance', label: 'Maintenance', icon: Wrench, group: 'Property' },
  { id: 'documents', route: 'documents', label: 'Documents', icon: FileText, group: 'Property' },
  { id: 'analytics', route: 'analytics', label: 'Reports', icon: BarChart3, group: 'Property' },
  { id: 'settings', route: 'settings', label: 'Settings', icon: Settings, group: 'Property' },
  { id: 'more', route: 'more', label: 'More tools', mobileLabel: 'More', icon: MoreHorizontal, group: 'More' },
  { id: 'ebApprovals', route: 'eb-approvals', label: 'EB approvals', icon: ZapOff, group: 'More', hidden: true },
  { id: 'waterApprovals', route: 'water-approvals', label: 'Water approvals', icon: Droplets, group: 'More', hidden: true },
  { id: 'expenses', route: 'expenses', label: 'Expenses', icon: IndianRupee, group: 'More', hidden: true },
  { id: 'calendar', route: 'calendar', label: 'Payment calendar', icon: CalendarDays, group: 'More', hidden: true },
  { id: 'reminders', route: 'reminders', label: 'Reminders', icon: Bell, group: 'More', hidden: true },
  { id: 'contacts', route: 'contacts', label: 'Service contacts', icon: Phone, group: 'More', hidden: true },
  { id: 'community', route: 'community', label: 'Community', icon: MessagesSquare, group: 'More', hidden: true },
  { id: 'setup', route: 'setup', label: 'Property setup', icon: DoorOpen, group: 'More', hidden: true },
  { id: 'complaints', route: 'complaints', label: 'Complaints', icon: MessageSquareWarning, group: 'More', hidden: true },
]

const GROUPS = ['Workspace', 'Finance', 'Property', 'More']
const MOBILE_PRIMARY = ['home', 'houses', 'approvals', 'tenants', 'more']

export default function OwnerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const pathSegment = location.pathname.split('/owner/')[1] || 'home'
  const activeTabObj = TABS.find(t => t.route === pathSegment) || TABS[0]
  const tab = activeTabObj.id
  const [searchHouseId, setSearchHouseId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [propertyVersion, setPropertyVersion] = useState(0)

  useEffect(() => {
    const refresh = () => setPropertyVersion(v => v + 1)
    window.addEventListener('rm:property-changed', refresh)
    window.addEventListener('rm:property-created', refresh)
    return () => {
      window.removeEventListener('rm:property-changed', refresh)
      window.removeEventListener('rm:property-created', refresh)
    }
  }, [])

  // Warm the most-used lazily-loaded screens once the dashboard is idle so
  // moving between sections feels instant instead of showing a loader.
  useEffect(() => {
    const warm = () => {
      import('./OwnerHome')
      import('./HouseManager')
      import('./TenantsSection')
      import('./RentApprovalQueue')
      import('./PaymentCalendar')
      import('./MoreMenu')
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 3000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const timer = setTimeout(warm, 1500)
    return () => clearTimeout(timer)
  }, [])

  function go(t) {
    const target = TABS.find(x => x.id === t)?.route || 'home'
    navigate(`/owner/${target}`, t === 'tenants' ? { state: { resetTenantsAt: Date.now() } } : undefined)
  }

  function handleSearchSelect(houseId) {
    setSearchHouseId(houseId)
    navigate('/owner/tenants')
  }

  if (user?.appMode === 'dad-lite') return <DadLiteDashboard />

  return (
    <div className="rm-owner-shell min-h-screen bg-paper text-ink">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="rm-owner-layout">
        <aside className="rm-owner-sidebar hidden lg:flex">
          <div className="rm-owner-brand"><Building2 size={19}/><span>Rental Manager</span></div>
          <div className="rm-workspace-badge"><span>OWNER WORKSPACE</span><strong><PropertySwitcher /></strong></div>
          <nav aria-label="Owner workspace" className="rm-owner-nav">
            {GROUPS.map(group => <div key={group} className="rm-owner-nav-group">
              {group !== 'Workspace' && <div className="rm-owner-nav-heading">{group}</div>}
              {TABS.filter(t => t.group === group && !t.hidden).map(t => {
                const active = tab === t.id
                return <button key={t.id} onClick={() => go(t.id)} aria-current={active ? 'page' : undefined} className={`rm-owner-nav-item ${active ? 'is-active' : ''}`}>
                  <t.icon size={16}/><span>{t.label}</span>{t.badge && <span className="rm-nav-badge" aria-label="Pending approvals"/>}
                </button>
              })}
            </div>)}
          </nav>
          <div className="rm-owner-profile"><span className="rm-profile-avatar">{user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt=""/> : user?.name?.[0]}</span><span><strong>{user?.name}</strong><small>{user?.role === 'admin' ? 'Super Admin' : 'Property owner'}</small></span></div>
        </aside>
        <div className="rm-owner-main-column">
          <header className="rm-owner-topbar">
            <div className="rm-mobile-brand lg:hidden"><span className="rm-profile-avatar">{user?.name?.[0]}</span><PropertySwitcher /></div>
            <div className="rm-topbar-property hidden lg:block"><PropertySwitcher /></div>
            <div className="rm-topbar-actions">
              <div className="hidden md:block"><SearchBar onSelectHouse={handleSearchSelect} /></div>
              <NotificationBell userId={user?.uid} />
              <ThemeToggle />
              <button type="button" onClick={() => setSettingsOpen(true)} className="rm-icon-button" aria-label="Open account settings"><Settings size={17}/></button>
              <IconButton icon={LogOut} label="Log out" onClick={logout} />
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="rm-owner-content">
          <div className="rm-owner-content-inner">
            <div className="md:hidden mb-4"><SearchBar onSelectHouse={handleSearchSelect} /></div>
            <AnimatePresence mode="wait">
              <motion.div key={`${location.pathname}:${propertyVersion}`} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .16 }}>
                <Suspense fallback={<LoadingScreen />}>
                  <RouteErrorBoundary>
                    <Routes>
                    <Route path="home" element={<OwnerHome onNavigate={go} />} />
                    <Route path="houses" element={<HouseManager />} />
                    <Route path="setup" element={<PropertySetup />} />
                    <Route path="tenants" element={<TenantsSection openHouseId={searchHouseId} onOpenHouseHandled={() => setSearchHouseId(null)} />} />
                    <Route path="calendar" element={<PaymentCalendar />} />
                    <Route path="approvals" element={<RentApprovalQueue />} />
                    <Route path="eb-bill" element={<EBBillCreator />} />
                    <Route path="eb-approvals" element={<EBApprovalQueue />} />
                    <Route path="water-bill" element={<WaterBillCreator />} />
                    <Route path="water-approvals" element={<WaterApprovalQueue />} />
                    <Route path="notices" element={<NoticeManager />} />
                    <Route path="complaints" element={<ComplaintInbox />} />
                    <Route path="maintenance" element={<MaintenanceManager />} />
                    <Route path="contacts" element={<ServiceContactsManager />} />
                    <Route path="manual-entry" element={<ManualEntryForTenant />} />
                    <Route path="documents" element={<DocumentVerification />} />
                    <Route path="expenses" element={<ExpenseTracker />} />
                    <Route path="reminders" element={<PaymentReminders />} />
                    <Route path="reports" element={<MonthlyReport />} />
                    <Route path="analytics" element={<AnalyticsDashboard />} />
                    <Route path="community" element={<CommunityBoard user={user} canModerate />} />
                    <Route path="more" element={<MoreMenu />} />
                    <Route path="settings" element={<AppSettings />} />
                    <Route path="*" element={<OwnerHome onNavigate={go} />} />
                    </Routes>
                  </RouteErrorBoundary>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
          </main>
        </div>
      </div>

      <nav className="rm-mobile-nav lg:hidden fixed bottom-0 inset-x-0 bg-paper-raised/95 backdrop-blur-xl border-t border-[var(--rm-border)] flex items-stretch z-40 shadow-[0_-8px_24px_rgba(23,32,51,.08)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Primary">
        {TABS.filter(t => MOBILE_PRIMARY.includes(t.id)).map(t => {
          const active = tab === t.id
          return <button key={t.id} onClick={() => go(t.id)} title={t.mobileLabel || t.label} aria-label={t.mobileLabel || t.label} className={`flex-1 min-w-0 flex items-center justify-center py-2 px-1 ${active ? 'text-brand' : 'text-ink-soft'}`} aria-current={active ? 'page' : undefined}><span className={`w-11 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-brand/10' : ''}`}><t.icon size={21} /></span></button>
        })}
      </nav>

      <InstallAppPrompt />
      <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}


class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Owner screen error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-bold text-red-700">This screen could not be loaded</div>
        <p className="mt-1 text-sm text-ink-soft">Your saved property data is still safe. Refresh the page or go back to Overview.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('rm:app-refresh'))} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white">Refresh</button>
          <button type="button" onClick={() => this.setState({ error: null })} className="rounded-xl border border-[var(--rm-border)] px-4 py-2.5 text-sm font-bold text-ink">Try again</button>
        </div>
      </div>
    )
  }
}
