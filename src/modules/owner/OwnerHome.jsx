import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, AlertCircle, Users, Zap, Bell, PenSquare, ArrowRight, CalendarDays, ReceiptIndianRupee, Wrench, UserPlus, FileBarChart, Megaphone, Droplets, MoreHorizontal, Activity } from 'lucide-react'
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
  const [attention, setAttention] = useState([])

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
      const attentionRows = []
      
      const paymentsList = await Promise.all(
        occupied.map((h) => listRentHistory(h.id))
      )
      
      occupied.forEach((h, index) => {
        const payments = paymentsList[index]
        const status = resolveMonthStatus(payments, month)
        if (status === 'paid') collected += h.rentAmount
        const monthsPending = countMonthsPending(payments)
        if (monthsPending > 0) {
          pendingHouses++
          attentionRows.push({ house: h.internalDoorNumber, tenant: h.tenantName, months: monthsPending })
        }
      })

      setStats({ occupied: occupied.length, vacant, collected, pendingHouses, total: houses.length })
      setAttention(attentionRows.slice(0, 5))
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

      <section className="rounded-3xl border border-[var(--rm-border)] bg-paper-raised shadow-sm p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div><SectionHeader icon={PenSquare} label="Workflow" /><h3 className="font-display text-xl font-bold text-ink mt-1">What do you want to do?</h3></div>
          <span className="text-xs text-ink-soft">10 tools</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <QuickAction icon={Home} label="Houses" hint="Property setup" onClick={() => onNavigate('houses')} />
          <QuickAction icon={UserPlus} label="Add tenant" hint="New resident" onClick={() => onNavigate('houses')} />
          <QuickAction icon={ReceiptIndianRupee} label="Review rent" hint="Approvals" onClick={() => onNavigate('approvals')} />
          <QuickAction icon={CalendarDays} label="Payment calendar" hint="Monthly view" onClick={() => onNavigate('calendar')} />
          <QuickAction icon={Zap} label="EB bill" hint="Create bill" onClick={() => onNavigate('eb')} />
          <QuickAction icon={Droplets} label="Water bill" hint="Create bill" onClick={() => onNavigate('water')} />
          <QuickAction icon={Megaphone} label="Post notice" hint="Residents" onClick={() => onNavigate('notices')} />
          <QuickAction icon={Wrench} label="Maintenance" hint="Requests" onClick={() => onNavigate('complaints')} />
          <QuickAction icon={FileBarChart} label="Reports" hint="Monthly insights" onClick={() => onNavigate('reports')} />
          <QuickAction icon={MoreHorizontal} label="More tools" hint="Everything else" onClick={() => onNavigate('more')} />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-3xl border border-[var(--rm-border)] bg-paper-raised shadow-sm p-5">
          <div className="flex items-center justify-between mb-3"><div><SectionHeader icon={Activity} label="Needs attention" /><h3 className="font-display text-lg font-bold text-ink mt-1">Follow-ups</h3></div>{attention.length > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">{attention.length}</span>}</div>
          {attention.length ? <div className="space-y-2">{attention.map(a => <button key={a.house} onClick={() => onNavigate('tenants')} className="w-full flex items-center gap-3 rounded-2xl border border-[var(--rm-border)] bg-paper p-3 text-left hover:border-brand/30"><div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><ReceiptIndianRupee size={18}/></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-ink truncate">{a.tenant || 'Tenant'} · House {a.house}</p><p className="text-xs text-ink-soft">{a.months} month{a.months===1?'':'s'} without an approved rent payment</p></div><ArrowRight size={16} className="text-ink-soft"/></button>)}</div> : <div className="rounded-2xl bg-brand/5 border border-brand/10 p-4 text-sm text-ink-soft">Everything looks clear. No rent follow-ups right now.</div>}
        </section>

        <section className="rounded-3xl border border-[var(--rm-border)] bg-paper-raised shadow-sm p-5">
          <div className="flex items-center justify-between mb-3"><div><SectionHeader icon={Bell} label="Communication" /><h3 className="font-display text-lg font-bold text-ink mt-1">Latest notices</h3></div><button onClick={() => onNavigate('notices')} className="text-xs font-semibold text-brand">View all</button></div>
          {notices.length ? <div className="space-y-2">{notices.slice(0,4).map(n => <div key={n.id} className="rounded-2xl bg-paper border border-[var(--rm-border)] p-3"><p className="text-sm font-medium text-ink line-clamp-2">{n.message}</p><p className="text-xs text-ink-soft mt-1">Active notice</p></div>)}</div> : <div className="rounded-2xl bg-paper border border-[var(--rm-border)] p-4 text-sm text-ink-soft">No active notices. Publish one when residents need an update.</div>}
        </section>
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

function QuickAction({ icon: Icon, label, hint, onClick }) {
  return (
    <motion.button whileTap={{ scale: .98 }} onClick={onClick} className="group text-left rounded-2xl border border-[var(--rm-border)] bg-paper p-3 hover:border-brand/30 hover:shadow-sm transition min-w-0">
      <div className="flex items-center gap-2"><span className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0"><Icon size={17}/></span><ArrowRight size={14} className="ml-auto text-ink-soft group-hover:text-brand transition"/></div>
      <p className="text-sm font-semibold text-ink mt-2 truncate">{label}</p><p className="text-[11px] text-ink-soft mt-0.5 truncate">{hint}</p>
    </motion.button>
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
