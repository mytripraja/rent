import React, { useRef, useState, Suspense } from 'react'
import { LogOut, HelpCircle } from 'lucide-react'

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

export default function TenantDashboard() {
  const { user } = useAuth()
  const [replayTour, setReplayTour] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
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
          <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
            <TenantRentHero key={`hero-${refreshKey}`} onPayNow={() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
            <RentRevisionBanner />
            <NoticeFeed />
          </div>

          <main id="main-content" tabIndex={-1} className="px-4 sm:px-6 pb-6 max-w-4xl mx-auto space-y-6">
            <div ref={payRef} className="grid md:grid-cols-2 gap-4">
              <RentSubmission onSubmitted={() => setRefreshKey(k => k + 1)} />
              <RentHistory key={`history-${refreshKey}`} />
            </div>

            <EBBillShare key={`eb-${refreshKey}`} />
            <WaterBillShare key={`water-${refreshKey}`} />

            <section aria-labelledby="more-heading">
              <h2 id="more-heading" className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">More</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <RaiseComplaint />
                <RentAgreementView />
                <Directory />
                <ServiceContacts />
                <DocumentUpload />
                <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
                  <MaintenanceRequest />
                </div>
                <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
                  <VisitorLog />
                </div>
                <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
                  <BookCommonArea />
                </div>
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
                <EventCalendar />
              </div>
              <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
                <WasteSchedule />
              </div>
            </div>

            <CommunityBoard user={user} />

            <footer className="text-center text-xs text-ink-soft py-4 border-t border-brass/15">
              Need help? Check <span className="font-medium text-ink">Service Contacts</span> above, or raise a complaint and the owner will reach out.
            </footer>
          </main>
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
