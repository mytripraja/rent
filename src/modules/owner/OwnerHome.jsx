import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Home, AlertCircle, Users, Zap, Bell, PenSquare, ArrowRight, CalendarDays,
  ReceiptIndianRupee, Wrench, UserPlus, FileBarChart, Megaphone, Droplets,
  MoreHorizontal, Activity, BarChart3, ShieldCheck, WalletCards, Settings2,
  ClipboardCheck, CircleCheck, Building2, Clock3, Sparkles
} from 'lucide-react'
import { listHouses } from '../../services/houseService'
import { listRentHistory, countMonthsPending, currentMonthStr, resolveMonthStatus } from '../../services/rentService'
import { listActiveNoticesForHouses } from '../../services/noticeService'
import { listAllComplaints } from '../../services/complaintService'
import { useAuth } from '../../context/AuthContext'
import { Skeleton } from '../shared/ui/Skeleton'
import Tilt3D from '../shared/ui/Tilt3D'
import AnimatedCounter from '../shared/ui/AnimatedCounter'

export default function OwnerHome({ onNavigate }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [notices, setNotices] = useState([])
  const [openComplaints, setOpenComplaints] = useState(0)
  const [attention, setAttention] = useState([])
  const [rentTrend, setRentTrend] = useState([])
  const [recentPayments, setRecentPayments] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const houses = await listHouses()
      const occupied = houses.filter((h) => h.status === 'occupied')
      const month = currentMonthStr()
      const paymentsList = await Promise.all(occupied.map((h) => listRentHistory(h.id)))
      const paymentRows = paymentsList.flatMap((rows, index) => rows.map(payment => ({ ...payment, _house: occupied[index] })))
      let collected = 0
      let pendingHouses = 0
      const attentionRows = []

      occupied.forEach((h, index) => {
        const payments = paymentsList[index] || []
        const currentPayment = payments.find(p => p.month === month && p.status === 'approved')
        if (currentPayment) collected += Number(currentPayment.amount || 0)
        const monthsPending = countMonthsPending(payments)
        if (monthsPending > 0) {
          pendingHouses++
          attentionRows.push({ house: h.internalDoorNumber, tenant: h.tenantName, months: monthsPending })
        }
      })

      setStats({ occupied: occupied.length, total: houses.length, collected, pendingHouses })
      setAttention(attentionRows.sort((a, b) => b.months - a.months).slice(0, 5))
      const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date()
        date.setDate(1)
        date.setMonth(date.getMonth() - (5 - index))
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const total = paymentRows.filter(payment => payment.month === key && payment.status === 'approved')
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
        return { key, label: date.toLocaleDateString('en-IN', { month: 'short' }), total }
      })
      setRentTrend(months)
      setRecentPayments(paymentRows
        .slice()
        .sort((a, b) => Number(b.approvedAt || b.submittedAt || b.createdAt || 0) - Number(a.approvedAt || a.submittedAt || a.createdAt || 0))
        .slice(0, 5))
      setNotices(await listActiveNoticesForHouses(houses.map((h) => h.id)))
      const complaints = await listAllComplaints(houses.map((h) => h.id), houses[0]?.propertyId || null)
      setOpenComplaints(complaints.filter((c) => c.status === 'open').length)
    } catch (err) {
      console.error(err)
      setError(err)
    } finally { setLoading(false) }
  }



  if (loading) return <HomeSkeleton />
  if (error) return <div className="py-12 text-center"><p className="text-sm text-stamp-red mb-2">Failed to load property overview.</p><button onClick={load} className="text-xs bg-cover text-paper px-3 py-2 rounded-xl">Retry</button></div>
  if (!stats) return null

  const cards = [
    { id: 'houses', label: 'Occupied homes', value: `${stats.occupied}/${stats.total}`, icon: Home, tab: 'houses', sub: stats.total ? `${Math.round(stats.occupied / stats.total * 100)}% occupied` : 'No houses' },
    { id: 'rent', label: `Rent collected · ${monthLabel()}`, value: `₹${stats.collected.toLocaleString('en-IN')}`, count: stats.collected, prefix: '₹', icon: WalletCards, tab: 'approvals', sub: stats.pendingHouses ? `${stats.pendingHouses} house${stats.pendingHouses === 1 ? '' : 's'} need attention` : 'All current rent clear' },
    { id: 'pending', label: 'Rent follow-ups', value: stats.pendingHouses, count: stats.pendingHouses, icon: AlertCircle, tab: 'tenants', urgent: stats.pendingHouses > 0, sub: stats.pendingHouses ? 'Open payment items' : 'All clear' },
    { id: 'complaints', label: 'Open issues', value: openComplaints, count: openComplaints, icon: Wrench, tab: 'complaints', urgent: openComplaints > 0, sub: openComplaints ? 'Needs your attention' : 'No open issues' },
  ]

  const actions = [
    [Home, 'Houses', 'Property setup', 'houses'],
    [UserPlus, 'Add tenant', 'New resident', 'houses'],
    [ClipboardCheck, 'Review rent', 'Approvals', 'approvals'],
    [CalendarDays, 'Payment calendar', 'Monthly view', 'calendar'],
    [Zap, 'Create EB bill', 'Electricity', 'eb'],
    [Droplets, 'Create water bill', 'Water', 'water'],
    [Megaphone, 'Post notice', 'Residents', 'notices'],
    [Wrench, 'Maintenance', 'Repairs & requests', 'more'],
    [BarChart3, 'Analytics', 'Trends', 'analytics'],
    [FileBarChart, 'Reports', 'Monthly report', 'reports'],
    [Users, 'Household accounts', 'Family accounts', 'tenants'],
    [MoreHorizontal, 'More tools', 'Settings', 'more'],
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-xl border border-[var(--rm-border)] bg-white text-ink p-4 sm:p-6 shadow-sm">
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-brand text-[10px] uppercase tracking-[.15em] font-bold"><Sparkles size={13}/> Property workspace</div>
            <p className="font-mono-tab text-[11px] text-ink-soft uppercase tracking-wide mt-3">{todayLabel()}</p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">{greeting()}, {user?.name?.split(' ')[0]}</h2>
            <p className="text-sm text-ink-soft mt-1 max-w-xl">Rent, residents and property work at a glance.</p>
          </div>
          <div className="rounded-xl border border-[var(--rm-border)] bg-[#f8faf9] px-4 py-3 min-w-[180px]">
            <div className="flex items-center gap-2 text-ink-soft text-xs"><ShieldCheck size={16}/> This month</div>
            <div className="flex items-end gap-2 mt-1"><strong className="font-mono-tab text-3xl text-ink">{stats.occupied}/{stats.total}</strong><span className="text-xs text-ink-soft pb-1">homes occupied</span></div>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <Tilt3D key={c.id} className="h-full" max={7}>
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} whileTap={{ scale: .98 }} onClick={() => onNavigate(c.tab)} className="rm-card rm-card-hover flex h-full w-full flex-col text-left p-4 sm:p-5">
              <div className="flex items-center justify-between"><span className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.urgent ? 'bg-red-50 text-stamp-red' : 'bg-brand/10 text-brand'}`}><c.icon size={17}/></span><ArrowRight size={15} className="text-ink-soft"/></div>
              <p className="font-mono-tab text-xl sm:text-2xl text-ink mt-3">
                {c.count != null ? <AnimatedCounter value={c.count} prefix={c.prefix || ''} /> : c.value}
              </p>
              <p className="text-xs font-semibold text-ink mt-1 leading-4">{c.label}</p>
              <p className="text-[11px] text-ink-soft mt-1 leading-4">{c.sub}</p>
            </motion.button>
          </Tilt3D>
        ))}
      </div>

      <section className="rm-card p-4 sm:p-6">
        <div className="flex items-end justify-between gap-3 mb-4"><div><SectionHeader icon={PenSquare} label="Daily workflow"/><h3 className="font-display text-xl font-bold text-ink mt-1">What do you want to do?</h3></div><span className="text-xs text-ink-soft">Quick actions</span></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">{actions.map(([Icon, label, hint, tab], i) => <QuickAction key={label} icon={Icon} label={label} hint={hint} onClick={() => onNavigate(tab)} delay={i}/>)}</div>
      </section>

      <section className="rm-card p-4 sm:p-6" aria-labelledby="rm-rent-trend-title">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><SectionHeader icon={BarChart3} label="Rent collection"/><h3 id="rm-rent-trend-title" className="font-display text-lg font-bold text-ink mt-1">Monthly rent collection</h3><p className="text-xs text-ink-soft mt-1">Approved rent across the last six months.</p></div>
          <button onClick={() => onNavigate('reports')} className="text-xs font-semibold text-brand">View report</button>
        </div>
        <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-36 pt-2" role="img" aria-label={`Approved rent collection: ${rentTrend.map(item => `${item.label} ₹${item.total.toLocaleString('en-IN')}`).join(', ')}`}>
          {rentTrend.map(item => {
            const max = Math.max(1, ...rentTrend.map(point => point.total))
            const height = item.total ? Math.max(10, Math.round((item.total / max) * 100)) : 4
            return <div key={item.key} className="flex h-full flex-col items-center justify-end gap-2 min-w-0"><span className="hidden sm:block truncate text-[10px] text-ink-soft">{item.total ? `₹${item.total.toLocaleString('en-IN')}` : '—'}</span><div className="flex h-24 w-full items-end justify-center rounded-t-md bg-paper"><div className="w-4/5 rounded-t-md bg-brand transition-all" style={{ height: `${height}%` }} title={`${item.label}: ₹${item.total.toLocaleString('en-IN')}`}/></div><span className="text-[10px] font-medium text-ink-soft">{item.label}</span></div>
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-4">
        <section className="rm-card p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4 min-w-0"><div className="min-w-0"><SectionHeader icon={Activity} label="Needs attention"/><h3 className="font-display text-lg font-bold text-ink mt-1">Priority follow-ups</h3></div>{attention.length > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">{attention.length}</span>}</div>
          {attention.length ? <div className="space-y-2">{attention.map(a => <button key={a.house} onClick={() => onNavigate('tenants')} className="w-full min-w-0 overflow-hidden flex items-center gap-3 rounded-2xl border border-[var(--rm-border)] bg-paper p-3 text-left hover:border-brand/30 transition"><div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Clock3 size={18}/></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-ink truncate">{a.tenant || 'Tenant'} · House {a.house}</p><p className="text-xs text-ink-soft break-words leading-5">{a.months} month{a.months === 1 ? '' : 's'} without an approved rent payment</p></div><ArrowRight size={16} className="text-ink-soft"/></button>)}</div> : <div className="rounded-2xl bg-brand/5 border border-brand/10 p-4 text-sm text-ink-soft flex gap-2"><CircleCheck size={18} className="text-brand shrink-0"/> No rent follow-ups at the moment.</div>}
        </section>

        <section className="rm-card p-4 sm:p-6 min-w-0" aria-labelledby="rm-recent-activity-title">
          <div className="flex items-center justify-between gap-2 mb-4"><div><SectionHeader icon={Activity} label="Recent activity"/><h3 id="rm-recent-activity-title" className="font-display text-lg font-bold text-ink mt-1">Rent submissions</h3></div><button onClick={() => onNavigate('approvals')} className="text-xs font-semibold text-brand">View all</button></div>
          {recentPayments.length ? <div className="divide-y divide-[var(--rm-border)]">{recentPayments.map(payment => <div key={payment.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-semibold text-ink truncate">{payment._house?.internalDoorNumber || 'House'} · {payment._house?.tenantName || 'Tenant'}</p><p className="text-xs text-ink-soft mt-0.5">{payment.month} · {payment.mode || 'Payment submitted'}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-ink">₹{Number(payment.amount || 0).toLocaleString('en-IN')}</p><span className={`text-[10px] font-semibold ${payment.status === 'approved' ? 'text-green-700' : payment.status === 'rejected' ? 'text-red-600' : 'text-amber-700'}`}>{payment.status === 'approved' ? 'Approved' : payment.status === 'rejected' ? 'Rejected' : 'Pending approval'}</span></div></div>)}</div> : <p className="rounded-xl bg-paper p-4 text-sm text-ink-soft">No rent submissions yet.</p>}
        </section>

        <section className="rm-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4"><div><SectionHeader icon={Bell} label="Communication"/><h3 className="font-display text-lg font-bold text-ink mt-1">Latest notices</h3></div><button onClick={() => onNavigate('notices')} className="text-xs font-semibold text-brand">View all</button></div>
          {notices.length ? <div className="space-y-2">{notices.slice(0, 4).map(n => <div key={n.id} className="rounded-2xl bg-paper border border-[var(--rm-border)] p-3"><p className="text-sm font-medium text-ink line-clamp-2">{n.message}</p><p className="text-xs text-ink-soft mt-1">Active notice</p></div>)}</div> : <div className="rounded-2xl bg-paper border border-[var(--rm-border)] p-4 text-sm text-ink-soft">No active notices. Publish one when residents need an update.</div>}
        </section>
      </div>

      <section className="grid sm:grid-cols-3 gap-3">
        <MiniInsight icon={Building2} title="Property" value={`${stats.total} homes`} detail={`${stats.occupied} currently occupied`} onClick={() => onNavigate('houses')} />
        <MiniInsight icon={WalletCards} title="Finance" value={`₹${stats.collected.toLocaleString('en-IN')}`} detail={`${monthLabel()} rent collected`} onClick={() => onNavigate('reports')} />
        <MiniInsight icon={Settings2} title="Operations" value={`${openComplaints} open`} detail="Maintenance & complaints" onClick={() => onNavigate('complaints')} />
      </section>
    </div>
  )
}

function HomeSkeleton() { return <div className="space-y-6"><Skeleton className="h-48 w-full rounded-[28px]"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-32 rounded-2xl"/>)}</div><Skeleton className="h-64 rounded-3xl"/></div> }
function SectionHeader({ icon: Icon, label }) { return <div className="flex items-center gap-2 text-ink-soft"><Icon size={14}/><p className="text-xs font-semibold uppercase tracking-wide">{label}</p></div> }
function QuickAction({ icon: Icon, label, hint, onClick, delay = 0 }) { return <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * .025 }} whileTap={{ scale: .98 }} onClick={onClick} className="group text-left rounded-2xl border border-[var(--rm-border)] bg-paper p-3 hover:border-brand/30 hover:shadow-sm transition min-w-0"><div className="flex items-center gap-2"><span className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0"><Icon size={17}/></span><ArrowRight size={14} className="ml-auto text-ink-soft group-hover:text-brand transition"/></div><p className="text-sm font-semibold text-ink mt-2 truncate">{label}</p><p className="text-[11px] text-ink-soft mt-0.5 truncate">{hint}</p></motion.button> }
function MiniInsight({ icon: Icon, title, value, detail, onClick }) { return <button onClick={onClick} className="rm-card rm-card-hover p-4 text-left flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center"><Icon size={18}/></span><span className="min-w-0"><span className="block text-[10px] uppercase tracking-[.14em] text-ink-soft font-bold">{title}</span><strong className="block text-lg text-ink mt-0.5">{value}</strong><span className="block text-xs text-ink-soft truncate">{detail}</span></span></button> }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
function todayLabel() { return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function monthLabel() { return new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) }
