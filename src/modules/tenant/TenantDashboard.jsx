import { useRef, useState } from 'react'
import { LogOut, HelpCircle } from 'lucide-react'
import RentSubmission from './RentSubmission'
import RentHistory from './RentHistory'
import EBBillShare from './EBBillShare'
import NoticeFeed from './NoticeFeed'
import RaiseComplaint from './RaiseComplaint'
import Directory from './Directory'
import ServiceContacts from './ServiceContacts'
import RentRevisionBanner from './RentRevisionBanner'
import DocumentUpload from './DocumentUpload'
import TenantRentHero from './TenantRentHero'
import CommunityBoard from '../shared/CommunityBoard'
import OnboardingTour from '../shared/OnboardingTour'
import { TENANT_TOUR_STEPS } from './tenantTourSteps'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

export default function TenantDashboard() {
  const { user } = useAuth()
  const [replayTour, setReplayTour] = useState(false)
  const payRef = useRef(null)

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-cover text-paper px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brass/30 border border-brass overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0">
            {user?.name?.[0]}
          </div>
          <div>
            <h1 className="font-display text-lg leading-tight">Welcome, {user?.name}</h1>
            <p className="text-xs text-brass-light">Customer ID {user?.customerId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setReplayTour(true)} className="text-brass-light hover:text-paper" title="Help">
            <HelpCircle size={18} />
          </button>
          <button onClick={logout} className="text-brass-light hover:text-paper" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <TenantRentHero onPayNow={() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        <RentRevisionBanner />
        <NoticeFeed />
      </div>

      <main className="px-4 sm:px-6 pb-6 max-w-4xl mx-auto space-y-6">
        <div ref={payRef} className="grid md:grid-cols-2 gap-4">
          <RentSubmission onSubmitted={() => {}} />
          <RentHistory />
        </div>

        <EBBillShare />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">More</p>
          <div className="grid md:grid-cols-2 gap-4">
            <RaiseComplaint />
            <Directory />
            <ServiceContacts />
            <DocumentUpload />
          </div>
        </div>

        <CommunityBoard user={user} />
      </main>

      <OnboardingTour
        steps={TENANT_TOUR_STEPS}
        storageKey={`tour_seen_tenant_${user?.uid}`}
        forceOpen={replayTour ? true : undefined}
        onClose={() => setReplayTour(false)}
      />
    </div>
  )
}
