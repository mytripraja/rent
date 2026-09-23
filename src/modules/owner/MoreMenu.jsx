import { lazy, Suspense, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserRound, Settings, KeyRound, TrendingUp, Building2, Upload, ShieldCheck, CalendarDays,
  CarFront, Wrench, Footprints, Landmark, PartyPopper, ScrollText, BarChart3, Mail,
  DatabaseBackup, Sheet, BriefcaseBusiness, ArrowLeft, Map, ClipboardCheck, Wifi, Newspaper, Droplets, Plus
} from 'lucide-react'

const OwnerProfile = lazy(() => import('./OwnerProfile'))
const RentRevision = lazy(() => import('./RentRevision'))
const PropertySetup = lazy(() => import('./PropertySetup'))
const OwnerManager = lazy(() => import('./OwnerManager'))
const ActivityLog = lazy(() => import('./ActivityLog'))
const YearEndSummary = lazy(() => import('./YearEndSummary'))
const EmailReport = lazy(() => import('./EmailReport'))
const DataBackup = lazy(() => import('./DataBackup'))
const GoogleSheetsExport = lazy(() => import('./GoogleSheetsExport'))
const TallyExport = lazy(() => import('./TallyExport'))
const AppSettings = lazy(() => import('./AppSettings'))
const MaintenanceManager = lazy(() => import('./MaintenanceManager'))
const VisitorOverview = lazy(() => import('./VisitorOverview'))
const ParkingManager = lazy(() => import('./ParkingManager'))
const BookingApprovals = lazy(() => import('./BookingApprovals'))
const VacancyListing = lazy(() => import('./VacancyListing'))
const FestivalGreetings = lazy(() => import('./FestivalGreetings'))
const SecurityDataCenter = lazy(() => import('./SecurityDataCenter'))
const BlueprintManager = lazy(() => import('./BlueprintManager'))
const HouseAssetInspection = lazy(() => import('./HouseAssetInspection'))
const IndiaCalendar = lazy(() => import('../shared/IndiaCalendar'))
const NewsHub = lazy(() => import('../shared/NewsHub'))
const WifiShareBoard = lazy(() => import('../shared/WifiShareBoard'))
const ApartmentOperations = lazy(() => import('./ApartmentOperations'))
const FutureOperationsHub = lazy(() => import('./FutureOperationsHub'))
import { useAuth } from '../../context/AuthContext'
import { getActivePropertyId, getProperties } from '../../services/configService'
import { useNavigate, useSearchParams } from 'react-router-dom'

const SECTIONS = [
  { label: 'Account', items: [
    { id: 'profile', label: 'My Profile', icon: UserRound, desc: 'Personal details and account info' },
    { id: 'settings', label: 'App Settings', icon: Settings, desc: 'Language, appearance and preferences' },
  ]},
  { label: 'Property', items: [
    { id: 'rentRevision', label: 'Rent Revision', icon: TrendingUp, desc: 'Manage rent changes' },
    { id: 'setup', label: 'Property Setup', icon: Building2, desc: 'Property configuration' },
    { id: 'vacancy', label: 'Vacancy Listing', icon: Upload, desc: 'Manage available homes' },
    { id: 'parking', label: 'Parking Slots', icon: CarFront, desc: 'Visual parking map and assignments' },
    { id: 'blueprints', label: 'Blueprints', icon: Map, desc: 'Create house and apartment floor plans' },
    { id: 'assets', label: 'House Assets & Inspection', icon: ClipboardCheck, desc: 'Track fixtures, condition and move-in/vacate checks' },
    { id: 'apartmentOps', label: 'Apartment Operations', icon: Droplets, desc: 'Separate apartments, motors, tanks, problems and CCTV' },
    { id: 'newApartment', label: 'Create New Apartment', icon: Plus, desc: 'Create a separate apartment workspace' },
    { id: 'enterpriseOps', label: 'Advanced Operations ERP', icon: BriefcaseBusiness, desc: 'Accounting, maintenance, inventory, security, leases, analytics and integrations' },
  ]},
  { label: 'Tenant Services', items: [
    { id: 'maintenance', label: 'Maintenance Requests', icon: Wrench, desc: 'Track repairs and requests' },
    { id: 'visitors', label: 'Visitor Log', icon: Footprints, desc: 'Review visitor activity' },
    { id: 'bookings', label: 'Common Area Bookings', icon: Landmark, desc: 'Approve shared-space bookings' },
  ]},
  { label: 'Community', items: [
    { id: 'wifi', label: 'Neighbour Wi-Fi Sharing', icon: Wifi, desc: 'Offer or find shared internet and track interest' },
    { id: 'news', label: 'News Hub', icon: Newspaper, desc: 'Local and common headlines from approved feeds' },
    { id: 'festivals', label: 'Festival Greetings', icon: PartyPopper, desc: 'Send community greetings' },
    { id: 'calendarHub', label: 'India Calendar & Panchang', icon: CalendarDays, desc: 'Tamil calendar, festivals, timings and weather' },
  ]},
  { label: 'Security & data', items: [
    { id: 'security', label: 'Security & Data Center', icon: ShieldCheck, desc: 'Audit, backup and account controls' },
  ]},
  { label: 'Reports & Data', items: [
    { id: 'activity', label: 'Activity Log', icon: ScrollText, desc: 'See who changed what' },
    { id: 'yearEnd', label: 'Year-End Summary', icon: BarChart3, desc: 'Annual property summary' },
    { id: 'emailReport', label: 'Email Report', icon: Mail, desc: 'Send a report by email' },
    { id: 'dataBackup', label: 'Data Backup', icon: DatabaseBackup, desc: 'Export a backup of your data' },
    { id: 'googleSheets', label: 'Google Sheets Export', icon: Sheet, desc: 'Export records to Sheets' },
    { id: 'tally', label: 'Tally Export', icon: BriefcaseBusiness, desc: 'Export accounting data' },
  ]},
]

export default function MoreMenu() {
  const { user } = useAuth()
  const [view, setView] = useState(null)
  const [activeProperty, setActiveProperty] = useState(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const tool = searchParams.get('tool')
    if (tool) setView(tool)
  }, [searchParams])
  useEffect(() => {
    let alive = true
    async function loadActive() {
      try {
        const props = await getProperties()
        const id = getActivePropertyId()
        const found = props.find(p => p.id === id) || props[0]
        if (alive) setActiveProperty(found || null)
      } catch {}
    }
    loadActive()
    const refresh = () => loadActive()
    window.addEventListener('rm:property-changed', refresh)
    window.addEventListener('rm:property-created', refresh)
    return () => { alive = false; window.removeEventListener('rm:property-changed', refresh); window.removeEventListener('rm:property-created', refresh) }
  }, [])
  const isAdmin = user?.role === 'admin'
  const sections = isAdmin
    ? [{ ...SECTIONS[0], items: [...SECTIONS[0].items, { id: 'owners', label: 'Owner Management', icon: KeyRound, desc: 'Manage co-owner access' }] }, ...SECTIONS.slice(1)]
    : SECTIONS

  const renderView = () => {
    const map = {
      profile: <OwnerProfile />, rentRevision: <RentRevision />, setup: <PropertySetup />, settings: <AppSettings />,
      activity: <ActivityLog />, yearEnd: <YearEndSummary />, emailReport: <EmailReport />, dataBackup: <DataBackup />,
      googleSheets: <GoogleSheetsExport />, tally: <TallyExport />, maintenance: <MaintenanceManager />, visitors: <VisitorOverview />,
      parking: <ParkingManager />, blueprints: <BlueprintManager />, assets: <HouseAssetInspection />, apartmentOps: <ApartmentOperations initialCreate={searchParams.get('create') === '1'} />, newApartment: <ApartmentOperations initialCreate />, enterpriseOps: <FutureOperationsHub />, wifi: <WifiShareBoard ownerOnly />, news: <NewsHub />, bookings: <BookingApprovals />, vacancy: <VacancyListing />, festivals: <FestivalGreetings />, calendarHub: <IndiaCalendar />,
      owners: isAdmin ? <OwnerManager /> : null,
      security: <SecurityDataCenter />,
    }
    return map[view] || null
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {view ? (
          <motion.div key="subview" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <button onClick={() => { setView(null); navigate('/owner/more', { replace: true }) }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline mb-5"><ArrowLeft size={16} /> Back to More Tools</button>
            <Suspense fallback={<div className="rm-card p-6 animate-pulse"><div className="h-5 w-48 rounded bg-paper-raised"/><div className="h-3 w-72 max-w-full rounded bg-paper-raised mt-3"/><div className="h-32 rounded-2xl bg-paper-raised mt-5"/></div>}>{renderView()}</Suspense>
          </motion.div>
        ) : (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            <div className="rounded-2xl border border-brand/15 bg-brand/5 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[.14em] text-brand">Current apartment</div>
                  <div className="mt-1 flex items-center gap-2 min-w-0"><Building2 size={18} className="text-brand shrink-0"/><strong className="truncate">{activeProperty?.name || 'My Apartment'}</strong></div>
                  {activeProperty?.address && <p className="text-xs text-ink-soft mt-1 truncate">{activeProperty.address}</p>}
                </div>
                <button type="button" onClick={() => setView('newApartment')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shrink-0"><Plus size={16}/> New apartment</button>
              </div>
            </div>
            <div>
              <div className="rm-kicker">Workspace</div>
              <h2 className="font-display text-3xl font-extrabold mt-1">More tools</h2>
              <p className="text-sm text-ink-soft mt-1">Less-frequent tools, settings and exports in one place.</p>
            </div>
            {sections.map(section => (
              <section key={section.label}>
                <h3 className="text-xs font-bold uppercase tracking-[.14em] text-ink-soft mb-3">{section.label}</h3>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {section.items.map(item => {
                    const Icon = item.icon
                    return <button key={item.id} onClick={() => setView(item.id)} className="rm-card rm-card-hover p-4 text-left flex items-center gap-4 group">
                      <span className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 group-hover:bg-brand group-hover:text-white transition"><Icon size={20} /></span>
                      <span className="min-w-0"><span className="block text-sm font-bold text-ink">{item.label}</span><span className="block text-xs text-ink-soft mt-0.5 leading-5">{item.desc}</span></span>
                    </button>
                  })}
                </div>
              </section>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
