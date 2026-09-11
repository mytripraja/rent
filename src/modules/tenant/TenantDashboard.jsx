import React, { useRef, useState, Suspense } from 'react'
import { LogOut, HelpCircle, Home, WalletCards, Wrench, MessagesSquare, FileText } from 'lucide-react'

const RentSubmission = React.lazy(() => import('./RentSubmission'))
const RentHistory = React.lazy(() => import('./RentHistory'))
const EBBillShare = React.lazy(() => import('./EBBillShare'))
const WaterBillShare = React.lazy(() => import('./WaterBillShare'))
const NoticeFeed = React.lazy(() => import('./NoticeFeed'))
const RaiseComplaint = React.lazy(() => import('./RaiseComplaint'))
const RentAgreementView = React.lazy(() => import('./RentAgreementView'))
const Directory = React.lazy(() => import('./Directory'))
const ServiceContacts = React.lazy(() => import('./ServiceContacts'))
const RentRevisionBanner = React.lazy(() => import('./RentRevisionBanner'))
const DocumentUpload = React.lazy(() => import('./DocumentUpload'))
const TenantRentHero = React.lazy(() => import('./TenantRentHero'))
const CommunityBoard = React.lazy(() => import('../shared/CommunityBoard'))
const MaintenanceRequest = React.lazy(() => import('./MaintenanceRequest'))
const VisitorLog = React.lazy(() => import('./VisitorLog'))
const BookCommonArea = React.lazy(() => import('./BookCommonArea'))
const EventCalendar = React.lazy(() => import('../shared/EventCalendar'))
const WasteSchedule = React.lazy(() => import('../shared/WasteSchedule'))
import LoadingScreen from '../shared/LoadingScreen'
import PullToRefresh from '../shared/ui/PullToRefresh'
import OnboardingTour from '../shared/OnboardingTour'
import IconButton from '../shared/ui/IconButton'
import ThemeToggle from '../shared/ui/ThemeToggle'
import NotificationBell from '../shared/ui/NotificationBell'
import LanguageSwitcher from '../shared/ui/LanguageSwitcher'
import { TENANT_TOUR_STEPS } from './tenantTourSteps'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

function CardShell({ children }) {
  return <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">{children}</div>
}

function HomeCard({ title, text, onClick }) {
  return <button onClick={onClick} className="w-full text-left bg-paper-raised rounded-2xl border border-brass/20 p-5 hover:shadow-md transition"><p className="font-semibold text-ink">{title}</p><p className="text-sm text-ink-soft mt-1">{text}</p><span className="inline-block mt-3 text-xs font-semibold text-cover">Open →</span></button>
}

export default function TenantDashboard() {
  const { user } = useAuth()
  const [replayTour, setReplayTour] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [section, setSection] = useState('home')
  const payRef = useRef(null)

  async function handleRefresh() {
    setRefreshKey(k => k + 1)
    await new Promise(r => setTimeout(r, 600))
  }

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="bg-cover text-paper px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brass/30 border border-brass overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden="true">
            {user?.name?.[0]}
          </div>
          <div>
            <h1 className="font-display text-lg leading-tight">Welcome, {user?.name}</h1>
            <p className="text-xs text-brass-light">Customer ID {user?.customerId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LanguageSwitcher />
          <NotificationBell userId={user?.uid} />
          <ThemeToggle />
          <IconButton icon={HelpCircle} label="Replay onboarding tour" onClick={() => setReplayTour(true)} />
          <IconButton icon={LogOut} label="Log out" onClick={logout} />
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh}>
        <Suspense fallback={<LoadingScreen />}>
          <div className="tenant-page">
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">
              <TenantRentHero key={`hero-${refreshKey}`} onPayNow={() => { setSection('rent'); requestAnimationFrame(() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }} />
              <RentRevisionBanner />
            </div>

            <nav className="tenant-tabs max-w-4xl mx-auto px-3 sm:px-6 sticky top-0 z-30" aria-label="Tenant sections">
              {[['home','Home',Home],['rent','Rent & bills',WalletCards],['services','Services',Wrench],['community','Community',MessagesSquare],['documents','Documents',FileText]].map(([id,label,Icon]) => (
                <button key={id} onClick={() => setSection(id)} className={`tenant-tab ${section === id ? 'tenant-tab-active' : ''}`} aria-current={section === id ? 'page' : undefined}>
                  <Icon size={17} aria-hidden="true" /> <span>{label}</span>
                </button>
              ))}
            </nav>

            <main id="main-content" tabIndex={-1} className="px-4 sm:px-6 pb-24 max-w-4xl mx-auto pt-5">
              {section === 'home' && (
                <div className="space-y-5">
                  <NoticeFeed />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <HomeCard title="Next payment" text="Check rent and bill status" onClick={() => setSection('rent')} />
                    <HomeCard title="Need something fixed?" text="Raise a maintenance request" onClick={() => setSection('services')} />
                  </div>
                  <CommunityBoard user={user} />
                </div>
              )}

              {section === 'rent' && (
                <div ref={payRef} className="space-y-5">
                  <RentSubmission onSubmitted={() => setRefreshKey(k => k + 1)} />
                  <RentHistory key={`history-${refreshKey}`} />
                  <EBBillShare key={`eb-${refreshKey}`} />
                  <WaterBillShare key={`water-${refreshKey}`} />
                </div>
              )}

              {section === 'services' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <CardShell><RaiseComplaint /></CardShell>
                  <CardShell><MaintenanceRequest /></CardShell>
                  <CardShell><VisitorLog /></CardShell>
                  <CardShell><BookCommonArea /></CardShell>
                  <CardShell><Directory /></CardShell>
                  <CardShell><ServiceContacts /></CardShell>
                  <CardShell><EventCalendar /></CardShell>
                  <CardShell><WasteSchedule /></CardShell>
                </div>
              )}

              {section === 'community' && <div className="space-y-5"><NoticeFeed /><CommunityBoard user={user} /></div>}

              {section === 'documents' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <CardShell><RentAgreementView /></CardShell>
                  <CardShell><DocumentUpload /></CardShell>
                </div>
              )}

              <footer className="text-center text-xs text-ink-soft py-6 mt-6 border-t border-brass/15">
                Need help? Use Service Contacts or raise a complaint and the owner will reach out.
              </footer>
            </main>
          </div>
        </Suspense>
      </PullToRefresh>
      <OnboardingTour
        steps={TENANT_TOUR_STEPS}
        storageKey={`tour_seen_tenant_${user?.uid}`}
        forceOpen={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />
    </div>
  )
}
