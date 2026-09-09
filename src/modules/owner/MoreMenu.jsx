import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings } from 'lucide-react'
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

// Grouped into sections now that this menu covers 15+ tools — a flat grid
// stopped being scannable once "orphaned" features got wired in here too.
const SECTIONS = [
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'My Profile', icon: '👤' },
      { id: 'settings', label: 'App Settings', icon: <Settings size={22} /> },
    ],
  },
  {
    label: 'Property',
    items: [
      { id: 'rentRevision', label: 'Rent Revision', icon: '📈' },
      { id: 'setup', label: 'Property Setup', icon: '🏗️' },
      { id: 'vacancy', label: 'Vacancy Listing', icon: '📤' },
      { id: 'parking', label: 'Parking Slots', icon: '🅿️' },
    ],
  },
  {
    label: 'Tenant Services',
    items: [
      { id: 'maintenance', label: 'Maintenance Requests', icon: '🔧' },
      { id: 'visitors', label: 'Visitor Log', icon: '🚶' },
      { id: 'bookings', label: 'Common Area Bookings', icon: '🏛️' },
    ],
  },
  {
    label: 'Community',
    items: [
      { id: 'festivals', label: 'Festival Greetings', icon: '🎉' },
    ],
  },
  {
    label: 'Reports & Data',
    items: [
      { id: 'activity', label: 'Activity Log', icon: '📜' },
      { id: 'yearEnd', label: 'Year-End Summary', icon: '📊' },
      { id: 'emailReport', label: 'Email Report', icon: '✉️' },
      { id: 'dataBackup', label: 'Data Backup', icon: '💾' },
      { id: 'googleSheets', label: 'Google Sheets Export', icon: '📝' },
      { id: 'tally', label: 'Tally Export', icon: '💼' },
    ],
  },
]

export default function MoreMenu() {
  const { user } = useAuth()
  const [view, setView] = useState(null)
  const isAdmin = user?.role === 'admin'

  const sections = isAdmin
    ? [
        { ...SECTIONS[0], items: [...SECTIONS[0].items, { id: 'owners', label: 'Owner Management', icon: '🔑' }] },
        ...SECTIONS.slice(1),
      ]
    : SECTIONS

  return (
    <div className="relative overflow-hidden min-h-[400px]">
      <AnimatePresence mode="wait">
        {view ? (
          <motion.div
            key="subview"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="space-y-4"
          >
            <button onClick={() => setView(null)} className="text-sm text-ink-soft hover:text-ink">← Back</button>
            {view === 'profile' && <OwnerProfile />}
            {view === 'rentRevision' && <RentRevision />}
            {view === 'setup' && <PropertySetup />}
            {view === 'settings' && <AppSettings />}
            {view === 'activity' && <ActivityLog />}
            {view === 'yearEnd' && <YearEndSummary />}
            {view === 'emailReport' && <EmailReport />}
            {view === 'dataBackup' && <DataBackup />}
            {view === 'googleSheets' && <GoogleSheetsExport />}
            {view === 'tally' && <TallyExport />}
            {view === 'maintenance' && <MaintenanceManager />}
            {view === 'visitors' && <VisitorOverview />}
            {view === 'parking' && <ParkingManager />}
            {view === 'bookings' && <BookingApprovals />}
            {view === 'vacancy' && <VacancyListing />}
            {view === 'festivals' && <FestivalGreetings />}
            {view === 'owners' && isAdmin && <OwnerManager />}
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="space-y-6"
          >
            <h2 className="text-lg font-semibold text-ink font-display">More Tools</h2>
            {sections.map((section) => (
              <div key={section.label}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">{section.label}</h3>
                <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setView(item.id)}
                      className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 text-left hover:shadow-md transition flex items-center gap-3"
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-sm font-medium text-ink">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
