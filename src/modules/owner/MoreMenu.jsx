import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserRound, Settings, KeyRound, TrendingUp, Building2, Upload,
  CarFront, Wrench, Footprints, Landmark, PartyPopper, ScrollText,
  BarChart3, Mail, DatabaseBackup, Sheet, BriefcaseBusiness, ArrowLeft
} from 'lucide-react'
import OwnerProfile from './OwnerProfile'
import RentRevision from './RentRevision'
import PropertySetup from './PropertySetup'
import OwnerManager from './OwnerManager'
import ActivityLog from './ActivityLog'
import YearEndSummary from './YearEndSummary'
import EmailReport from './EmailReport'
import DataBackup from './DataBackup'
import GoogleSheetsExport from './GoogleSheetsExport'
import TallyExport from './TallyExport'
import AppSettings from './AppSettings'
import MaintenanceManager from './MaintenanceManager'
import VisitorOverview from './VisitorOverview'
import ParkingManager from './ParkingManager'
import BookingApprovals from './BookingApprovals'
import VacancyListing from './VacancyListing'
import FestivalGreetings from './FestivalGreetings'
import { useAuth } from '../../context/AuthContext'

const SECTIONS = [
  { label: 'Account', items: [
    { id: 'profile', label: 'My Profile', icon: UserRound, desc: 'Personal details and account info' },
    { id: 'settings', label: 'App Settings', icon: Settings, desc: 'Language, appearance and preferences' },
  ]},
  { label: 'Property', items: [
    { id: 'rentRevision', label: 'Rent Revision', icon: TrendingUp, desc: 'Manage rent changes' },
    { id: 'setup', label: 'Property Setup', icon: Building2, desc: 'Property configuration' },
    { id: 'vacancy', label: 'Vacancy Listing', icon: Upload, desc: 'Manage available homes' },
    { id: 'parking', label: 'Parking Slots', icon: CarFront, desc: 'Assign and manage parking' },
  ]},
  { label: 'Tenant Services', items: [
    { id: 'maintenance', label: 'Maintenance Requests', icon: Wrench, desc: 'Track repairs and requests' },
    { id: 'visitors', label: 'Visitor Log', icon: Footprints, desc: 'Review visitor activity' },
    { id: 'bookings', label: 'Common Area Bookings', icon: Landmark, desc: 'Approve shared-space bookings' },
  ]},
  { label: 'Community', items: [
    { id: 'festivals', label: 'Festival Greetings', icon: PartyPopper, desc: 'Send community greetings' },
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
  const isAdmin = user?.role === 'admin'
  const sections = isAdmin
    ? [{ ...SECTIONS[0], items: [...SECTIONS[0].items, { id: 'owners', label: 'Owner Management', icon: KeyRound, desc: 'Manage co-owner access' }] }, ...SECTIONS.slice(1)]
    : SECTIONS

  const renderView = () => {
    const map = {
      profile: <OwnerProfile />, rentRevision: <RentRevision />, setup: <PropertySetup />, settings: <AppSettings />,
      activity: <ActivityLog />, yearEnd: <YearEndSummary />, emailReport: <EmailReport />, dataBackup: <DataBackup />,
      googleSheets: <GoogleSheetsExport />, tally: <TallyExport />, maintenance: <MaintenanceManager />, visitors: <VisitorOverview />,
      parking: <ParkingManager />, bookings: <BookingApprovals />, vacancy: <VacancyListing />, festivals: <FestivalGreetings />,
      owners: isAdmin ? <OwnerManager /> : null,
    }
    return map[view] || null
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {view ? (
          <motion.div key="subview" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <button onClick={() => setView(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline mb-5"><ArrowLeft size={16} /> Back to More Tools</button>
            {renderView()}
          </motion.div>
        ) : (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
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
