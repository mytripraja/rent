import React, { useState, Suspense } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, DoorOpen, Users, CheckCircle2, PenSquare, Zap, ZapOff,
  Bell, MessageSquareWarning, Phone, FileText, MessagesSquare, MoreHorizontal,
  LogOut, HelpCircle, IndianRupee, BarChart3, Droplets, CalendarDays,
  Menu, X, Wrench, Megaphone, ReceiptIndianRupee
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
  { id: 'notices', route: 'notices', label: 'Notices', icon: Megaphone, group: 'Operations' },
  { id: 'reminders', route: 'reminders', label: 'Reminders', icon: Bell, group: 'Operations' },
  { id: 'documents', route: 'documents', label: 'Documents', icon: FileText, group: 'Operations' },
  { id: 'contacts', route: 'contacts', label: 'Service contacts', icon: Phone, group: 'Operations' },
  { id: 'community', route: 'community', label: 'Community', icon: MessagesSquare, group: 'Community' },
  { id: 'reports', route: 'reports', label: 'Reports', icon: ReceiptIndianRupee, group: 'Insights' },
  { id: 'analytics', route: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Insights' },
  { id: 'more', route: 'more', label: 'More tools', icon: MoreHorizontal, group: 'Admin' },
]

const GROUPS = ['Daily', 'Money', 'Operations', 'Community', 'Insights', 'Admin']
const MOBILE_PRIMARY = ['home', 'houses', 'approvals', 'tenants', 'more']

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

  function go(t) {
    const target = TABS.find(x => x.id === t)?.route || 'home'
    navigate(`/owner/${target}`)
    setSidebarOpen(false)
  }

  function handleSearchSelect(houseId) {
    setSearchHouseId(houseId)
    navigate('/owner/tenants')
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="sticky top-0 z-50 bg-cover text-white border-b border-white/10 shadow-lg">
        <div className="h-[72px] px-4 lg:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold overflow-hidden shrink-0">
              {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" /> : user?.name?.[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-extrabold truncate">Rental Manager</h1>
                <PropertySwitcher />
              </div>
              <p className="text-xs text-white/65 truncate">{user?.name}{user?.role === 'admin' ? ' · Super Admin' : ' · Owner'}</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <SearchBar onSelectHouse={handleSearchSelect} />
            <LanguageSwitcher />
            <NotificationBell userId={user?.uid} />
            <ThemeToggle />
            <IconButton icon={HelpCircle} label="Replay onboarding tour" onClick={() => setReplayTour(true)} />
            <IconButton icon={LogOut} label="Log out" onClick={logout} />
          </div>
          <div className="md:hidden flex items-center gap-1">
            <NotificationBell userId={user?.uid} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className="hidden lg:flex w-[252px] shrink-0 border-r border-[var(--rm-border)] bg-paper-raised sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto">
          <div className="w-full p-4">
            <div className="px-3 pb-4 mb-2 border-b border-[var(--rm-border)]">
              <div className="text-[11px] font-bold uppercase tracking-[.13em] text-ink-soft">Property workspace</div>
              <div className="mt-1 text-sm font-semibold">Daily operations & property finance</div>
            </div>
            {GROUPS.map(group => {
              const items = TABS.filter(t => t.group === group)
              return (
                <div key={group} className="mb-5">
                  <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-ink-soft">{group}</div>
                  <div className="space-y-0.5">
                    {items.map(t => {
                      const active = tab === t.id
                      return (
                        <button key={t.id} onClick={() => go(t.id)} aria-current={active ? 'page' : undefined}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] transition ${active ? 'bg-brand/10 text-brand font-bold' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}>
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-brand text-white' : 'bg-paper text-ink-soft'}`}><t.icon size={16} /></span>
                          <span className="truncate">{t.label}</span>
                          {t.id === 'approvals' && <span className="ml-auto w-2 h-2 rounded-full bg-stamp-amber" aria-label="Pending approvals" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.button className="lg:hidden fixed inset-0 z-[60] bg-black/40" onClick={() => setSidebarOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label="Close navigation" />
              <motion.aside className="lg:hidden fixed left-0 top-0 bottom-0 z-[70] w-[292px] bg-paper-raised shadow-2xl overflow-y-auto" initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}>
                <div className="p-4 border-b border-[var(--rm-border)] flex items-center justify-between">
                  <div><div className="font-display font-extrabold text-lg">Rental Manager</div><div className="text-xs text-ink-soft">Property workspace</div></div>
                  <button className="w-9 h-9 rounded-lg bg-paper flex items-center justify-center" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
                </div>
                <div className="p-4">
                  {GROUPS.map(group => (
                    <div key={group} className="mb-5">
                      <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-ink-soft">{group}</div>
                      {TABS.filter(t => t.group === group).map(t => {
                        const active = tab === t.id
                        return <button key={t.id} onClick={() => go(t.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-left ${active ? 'bg-brand/10 text-brand font-bold' : 'text-ink-soft'}`}><t.icon size={18} /><span>{t.label}</span></button>
                      })}
                    </div>
                  ))}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-[1400px] mx-auto">
            <div className="md:hidden mb-4"><SearchBar onSelectHouse={handleSearchSelect} /></div>
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .16 }}>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="home" element={<OwnerHome onNavigate={go} />} />
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
                    <Route path="*" element={<OwnerHome onNavigate={go} />} />
                  </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-paper-raised/95 backdrop-blur-xl border-t border-[var(--rm-border)] flex items-stretch z-40 shadow-[0_-8px_24px_rgba(23,32,51,.08)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Primary">
        {TABS.filter(t => MOBILE_PRIMARY.includes(t.id)).map(t => {
          const active = tab === t.id
          return <button key={t.id} onClick={() => go(t.id)} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] ${active ? 'text-brand font-bold' : 'text-ink-soft'}`} aria-current={active ? 'page' : undefined}><span className={`w-8 h-7 rounded-lg flex items-center justify-center ${active ? 'bg-brand/10' : ''}`}><t.icon size={18} /></span>{t.label}</button>
        })}
      </nav>

      <OnboardingTour steps={OWNER_TOUR_STEPS} storageKey={`tour_seen_owner_${user?.uid}`} forceOpen={replayTour ? true : undefined} onClose={() => setReplayTour(false)} />
    </div>
  )
}
