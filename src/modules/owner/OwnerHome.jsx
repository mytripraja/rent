import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, AlertCircle, Users, Zap, Bell, PenSquare, ArrowRight } from 'lucide-react'
import { listHouses } from '../../services/houseService'
import { listRentHistory, countMonthsPending, currentMonthStr, resolveMonthStatus } from '../../services/rentService'
import { listActiveNotices } from '../../services/noticeService'
import { listAllComplaints } from '../../services/complaintService'
import { useAuth } from '../../context/AuthContext'

export default function OwnerHome({ onNavigate }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [notices, setNotices] = useState([])
  const [openComplaints, setOpenComplaints] = useState(0)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const houses = await listHouses()
    const occupied = houses.filter((h) => h.status === 'occupied')
    const vacant = houses.length - occupied.length
    const month = currentMonthStr()

    let collected = 0
    let pendingHouses = 0
    for (const h of occupied) {
      const payments = await listRentHistory(h.id)
      const status = resolveMonthStatus(payments, month)
      if (status === 'paid') collected += h.rentAmount
      if (countMonthsPending(payments) > 0) pendingHouses++
    }

    setStats({ occupied: occupied.length, vacant, collected, pendingHouses, total: houses.length })
    setNotices(await listActiveNotices())

    const complaints = await listAllComplaints()
    setOpenComplaints(complaints.filter((c) => c.status === 'open').length)

    setLoading(false)
  }

  if (loading || !stats) {
    return <p className="text-sm text-ink-soft py-8 text-center">Loading your ledger…</p>
  }

  const cards = [
    { id: 'houses', label: 'Occupied', value: `${stats.occupied}/${stats.total}`, icon: Home, tab: 'houses' },
    { id: 'rent', label: `Collected — ${monthLabel()}`, value: `₹${stats.collected.toLocaleString('en-IN')}`, icon: Zap, tab: 'approvals' },
    { id: 'pending', label: 'Rent Pending', value: stats.pendingHouses, icon: AlertCircle, tab: 'tenants', urgent: stats.pendingHouses > 0 },
    { id: 'complaints', label: 'Open Complaints', value: openComplaints, icon: Users, tab: 'complaints', urgent: openComplaints > 0 },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono-tab text-xs text-ink-soft uppercase tracking-wide">{todayLabel()}</p>
        <h2 className="font-display text-2xl text-ink mt-1">
          {greeting()}, {user?.name?.split(' ')[0]}
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate(c.tab)}
            className="text-left bg-paper-raised rounded-2xl border border-brass/25 shadow-sm p-4 hover:shadow-md transition"
          >
            <c.icon size={18} className={c.urgent ? 'text-stamp-red' : 'text-brass'} />
            <p className="font-mono-tab text-2xl text-ink mt-2">{c.value}</p>
            <p className="text-xs text-ink-soft mt-0.5">{c.label}</p>
          </motion.button>
        ))}
      </div>

      {notices.length > 0 && (
        <div>
          <SectionHeader icon={Bell} label="Active Notices" />
          <div className="space-y-2 mt-2">
            {notices.slice(0, 3).map((n) => (
              <div key={n.id} className="bg-paper-raised rounded-xl border border-brass/20 px-4 py-3 text-sm text-ink">
                {n.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionHeader icon={PenSquare} label="Quick Actions" />
        <div className="flex flex-wrap gap-2 mt-2">
          <QuickAction label="Manual Entry" onClick={() => onNavigate('manualEntry')} />
          <QuickAction label="Post Notice" onClick={() => onNavigate('notices')} />
          <QuickAction label="Create EB Bill" onClick={() => onNavigate('eb')} />
          <QuickAction label="View Tenants" onClick={() => onNavigate('tenants')} />
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 text-ink-soft">
      <Icon size={14} />
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
    </div>
  )
}

function QuickAction({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 bg-cover text-paper text-sm font-medium px-4 py-2 rounded-full hover:bg-cover-dark transition"
    >
      {label}
      <ArrowRight size={14} />
    </button>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function monthLabel() {
  return new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
