import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, AlertCircle, Users, Zap, Bell, PenSquare, ArrowRight } from 'lucide-react'
import { listHouses } from '../../services/houseService'
import { listRentHistory, countMonthsPending, currentMonthStr, resolveMonthStatus } from '../../services/rentService'
import { listActiveNotices } from '../../services/noticeService'
import { listAllComplaints } from '../../services/complaintService'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { Skeleton } from '../shared/ui/Skeleton'

export default function OwnerHome({ onNavigate }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [notices, setNotices] = useState([])
  const [openComplaints, setOpenComplaints] = useState(0)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const houses = await listHouses()
      const occupied = houses.filter((h) => h.status === 'occupied')
      const vacant = houses.length - occupied.length
      const month = currentMonthStr()

      let collected = 0
      let pendingHouses = 0
      
      const paymentsList = await Promise.all(
        occupied.map((h) => listRentHistory(h.id))
      )
      
      occupied.forEach((h, index) => {
        const payments = paymentsList[index]
        const status = resolveMonthStatus(payments, month)
        if (status === 'paid') collected += h.rentAmount
        if (countMonthsPending(payments) > 0) pendingHouses++
      })

      setStats({ occupied: occupied.length, vacant, collected, pendingHouses, total: houses.length })
      setNotices(await listActiveNotices())

      const complaints = await listAllComplaints()
      setOpenComplaints(complaints.filter((c) => c.status === 'open').length)
    } catch (err) {
      console.error(err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton variant="circle" className="w-4 h-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2 mb-8">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton variant="circle" className="w-4 h-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-32 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-stamp-red mb-2">Failed to load ledger.</p>
        <button onClick={load} className="text-xs bg-cover text-paper px-3 py-1.5 rounded-full">Retry</button>
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    { id: 'houses', label: t('occupied'), value: `${stats.occupied}/${stats.total}`, icon: Home, tab: 'houses' },
    { id: 'rent', label: `${t('rentCollected')} — ${monthLabel()}`, value: `₹${stats.collected.toLocaleString('en-IN')}`, icon: Zap, tab: 'approvals' },
    { id: 'pending', label: t('rentPending'), value: stats.pendingHouses, icon: AlertCircle, tab: 'tenants', urgent: stats.pendingHouses > 0 },
    { id: 'complaints', label: t('openComplaints'), value: openComplaints, icon: Users, tab: 'complaints', urgent: openComplaints > 0 },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono-tab text-xs text-ink-soft uppercase tracking-wide">{todayLabel()}</p>
        <h2 className="font-display text-2xl text-ink mt-1">
          {t('welcome')}, {user?.name?.split(' ')[0]}
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
          <QuickAction label="Reminders" onClick={() => onNavigate('reminders')} />
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
