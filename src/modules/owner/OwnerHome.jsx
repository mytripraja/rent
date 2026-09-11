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
  const [housePulse, setHousePulse] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const houses = await listHouses()
      const occupied = houses.filter((h) => h.status === 'occupied')
      setHousePulse(houses)
      const vacant = houses.length - occupied.length
      const month = currentMonthStr()

      let collected = 0
      let pendingHouses = 0
      let pendingApprovals = 0
      
      const paymentsList = await Promise.all(
        occupied.map((h) => listRentHistory(h.id))
      )
      
      occupied.forEach((h, index) => {
        const payments = paymentsList[index]
        const status = resolveMonthStatus(payments, month)
        const monthPayments = payments.filter((p) => p.month === month)
        collected += monthPayments
          .filter((p) => p.status === 'approved')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        if (status === 'waiting_approval') pendingApprovals++
        if (status !== 'paid' || countMonthsPending(payments) > 0) pendingHouses++
      })

      setStats({ occupied: occupied.length, vacant, collected, pendingHouses, pendingApprovals, total: houses.length })
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
    { id: 'pending', label: 'Needs attention', value: stats.pendingHouses, icon: AlertCircle, tab: 'tenants', urgent: stats.pendingHouses > 0 },
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

      {housePulse.length > 0 && (
        <section aria-labelledby="house-pulse">
          <div className="flex items-end justify-between mb-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Property pulse</p><h3 id="house-pulse" className="font-display text-lg mt-1">All {housePulse.length} houses</h3></div>
            <button onClick={() => onNavigate('houses')} className="text-xs font-semibold text-cover">Open houses →</button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {housePulse.map(h => <button key={h.id} onClick={() => onNavigate('houses')} title={`${h.internalDoorNumber} — ${h.status}`} className={`rounded-xl border p-2 text-center transition hover:-translate-y-0.5 ${h.status === 'occupied' ? 'border-stamp-green/30 bg-stamp-green/5' : 'border-stamp-amber/30 bg-stamp-amber/5'}`}>
              <span className="font-mono-tab text-sm font-semibold">{h.internalDoorNumber}</span><span className={`block text-[9px] mt-1 uppercase tracking-wide ${h.status === 'occupied' ? 'text-stamp-green' : 'text-stamp-amber'}`}>{h.status === 'occupied' ? 'Occupied' : 'Vacant'}</span>
            </button>)}
          </div>
        </section>
      )}

      {stats.pendingApprovals > 0 && (
        <button onClick={() => onNavigate('approvals')} className="w-full text-left bg-cover text-paper rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:bg-cover-dark transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brass/20 flex items-center justify-center"><CheckIcon /></div>
            <div><p className="font-semibold">{stats.pendingApprovals} rent {stats.pendingApprovals === 1 ? 'payment' : 'payments'} waiting for approval</p><p className="text-xs text-brass-light mt-0.5">Review and issue receipts</p></div>
          </div>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}

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

function CheckIcon() {
  return <span className="text-brass-light text-lg font-bold" aria-hidden="true">✓</span>
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
