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
const FamilyAccounts = React.lazy(() => import('./FamilyAccounts'))
const IndiaCalendar = React.lazy(() => import('../shared/IndiaCalendar'))
const WifiShareBoard = React.lazy(() => import('../shared/WifiShareBoard'))
const NewsHub = React.lazy(() => import('../shared/NewsHub'))
const WasteSchedule = React.lazy(() => import('../shared/WasteSchedule'))
const BlueprintManager = React.lazy(() => import('../owner/BlueprintManager'))
import LoadingScreen from '../shared/LoadingScreen'
import PullToRefresh from '../shared/ui/PullToRefresh'
import OnboardingTour from '../shared/OnboardingTour'
import IconButton from '../shared/ui/IconButton'
import ThemeToggle from '../shared/ui/ThemeToggle'
import NotificationBell from '../shared/ui/NotificationBell'
import LanguageSwitcher from '../shared/ui/LanguageSwitcher'
import InstallAppPrompt from '../shared/ui/InstallAppPrompt'
import { TENANT_TOUR_STEPS } from './tenantTourSteps'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { tenantCan } from '../../services/tenantAccountService'

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
          <NotificationBell userId={user?.uid} darkHeader />
          <ThemeToggle />
          <IconButton icon={HelpCircle} label="Replay onboarding tour" onClick={() => setReplayTour(true)} />
          <IconButton icon={LogOut} label="Log out" onClick={logout} />
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh}>
        <Suspense fallback={<LoadingScreen />}>
          <div id="tenant-home" className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 scroll-mt-4">
            {tenantCan(user, 'rent') && <TenantRentHero key={`hero-${refreshKey}`} onPayNow={() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />}
            {tenantCan(user, 'rent') && <RentRevisionBanner />}
            {tenantCan(user, 'notices') && <NoticeFeed />
            }
          </div>

          <main id="main-content" tabIndex={-1} className="px-4 sm:px-6 pb-24 lg:pb-6 max-w-4xl mx-auto space-y-6 scroll-mt-4">
            {tenantCan(user, 'rent') && <div id="tenant-rent" ref={payRef} className="grid md:grid-cols-2 gap-4">
              <RentSubmission onSubmitted={() => setRefreshKey(k => k + 1)} />
              <RentHistory key={`history-${refreshKey}`} />
            </div>}

            {tenantCan(user, 'bills') && <section id="tenant-bills" className="space-y-4 scroll-mt-4"><EBBillShare key={`eb-${refreshKey}`} /><WaterBillShare key={`water-${refreshKey}`} /></section>}

            <section id="tenant-more" aria-labelledby="more-heading" className="scroll-mt-4">
              <h2 id="more-heading" className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">More</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {tenantCan(user, 'complaints') && <RaiseComplaint />}
                {tenantCan(user, 'rent') && <RentAgreementView />}
                {tenantCan(user, 'directory') && <Directory />}
                {tenantCan(user, 'notices') && <ServiceContacts />}
                {tenantCan(user, 'documents') && <DocumentUpload />}
                <BlueprintManager />
                {tenantCan(user, 'maintenance') && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><MaintenanceRequest /></div>}
                {tenantCan(user, 'visitors') && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><VisitorLog /></div>}
                {tenantCan(user, 'commonArea') && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><BookCommonArea /></div>}
                {isSubAccount(user) && <FamilyAccessNotice />}
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><IndiaCalendar compact /></div>
              <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><WasteSchedule /></div>
            </div>

            {tenantCan(user, 'community') && <CommunityBoard user={user} />}
            {tenantCan(user, 'community') && <WifiShareBoard />}
            <NewsHub />
            {isPrimary(user) && <FamilyAccounts />}

            <footer className="text-center text-xs text-ink-soft py-4 border-t border-brass/15">
              Need help? Check <span className="font-medium text-ink">Service Contacts</span> above, or raise a complaint and the owner will reach out.
            </footer>
          </main>
        </Suspense>
      </PullToRefresh>

      <InstallAppPrompt />
      <nav className="tenant-mobile-nav lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper-raised/95 backdrop-blur-xl border-t border-[var(--rm-border)]" aria-label="Tenant quick navigation" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[['home','Home'],['rent','Rent'],['bills','Bills'],['more','More']].map(([id,label]) => <button key={id} onClick={() => document.getElementById(`tenant-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex-1 py-3 text-xs font-semibold text-ink-soft">{label}</button>)}
      </nav>

      <OnboardingTour
        steps={TENANT_TOUR_STEPS}
        storageKey={`tour_seen_tenant_${user?.uid}`}
        forceOpen={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />
    </div>
  )
}

function isSubAccount(user) { return user?.role === 'tenant' && user?.accountType === 'sub' }
function isPrimary(user) { return user?.role === 'tenant' && user?.accountType !== 'sub' }
function FamilyAccessNotice() { return <div className="md:col-span-2 rounded-2xl border border-brand/10 bg-brand/5 p-4 text-sm text-ink-soft">Some household tools are hidden by the main tenant. Ask the main account holder to enable access in Family accounts.</div> }
