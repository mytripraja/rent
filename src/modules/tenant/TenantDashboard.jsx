import RentSubmission from './RentSubmission'
import RentHistory from './RentHistory'
import EBBillShare from './EBBillShare'
import NoticeFeed from './NoticeFeed'
import RaiseComplaint from './RaiseComplaint'
import Directory from './Directory'
import ServiceContacts from './ServiceContacts'
import RentRevisionBanner from './RentRevisionBanner'
import DocumentUpload from './DocumentUpload'
import CommunityBoard from '../shared/CommunityBoard'
import OnboardingTour from '../shared/OnboardingTour'
import { TENANT_TOUR_STEPS } from './tenantTourSteps'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { useState } from 'react'

export default function TenantDashboard() {
  const { user } = useAuth()
  const [replayTour, setReplayTour] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-slate-800 text-base sm:text-lg">Welcome, {user?.name}</h1>
          <p className="text-xs text-slate-400">House {user?.houseId}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setReplayTour(true)} className="text-sm text-brand hover:text-brand-dark">Help</button>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">Log out</button>
        </div>
      </header>

      <div className="p-4 sm:p-6 pb-0">
        <RentRevisionBanner />
        <NoticeFeed />
      </div>

      <main className="p-4 sm:p-6 grid md:grid-cols-2 gap-6">
        <RentSubmission onSubmitted={() => {}} />
        <RentHistory />
        <EBBillShare />
        <RaiseComplaint />
        <Directory />
        <ServiceContacts />
        <DocumentUpload />
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
