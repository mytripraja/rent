import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Home, AlertCircle, Users, Zap, Bell, PenSquare, ArrowRight, Building2,
  IndianRupee, Droplets, CalendarDays, FileText, Megaphone, Wrench,
  BarChart3, CheckCircle2, ChevronRight, Sparkles
} from 'lucide-react'
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

  useEffect(() => { load() }, [])

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
      const paymentsList = await Promise.all(occupied.map((h) => listRentHistory(h.id)))
      occupied.forEach((h, index) => {
        const payments = paymentsList[index]
        const status = resolveMonthStatus(payments, month)
        if (status === 'paid') collected += Number(h.rentAmount || 0)
        if (countMonthsPending(payments) > 0) pendingHouses++
      })
      setStats({ occupied: occupied.length, vacant, collected, pendingHouses, total: houses.length })
      setNotices(await listActiveNotices())
      const complaints = await listAllComplaints()
      setOpenComplaints(complaints.filter((c) => c.status === 'open').length)
    } catch (err) {
      console.error(err)
      setError(err)
    } finally { setLoading(false) }
  }

  if (loading) return <HomeSkeleton />
  if (error) return (
    <div className="rm-home-error">
      <div className="rm-home-error-icon"><AlertCircle size={22} /></div>
      <p>We couldn't load your property overview.</p>
      <button onClick={load}>Try again</button>
    </div>
  )
  if (!stats) return null

  const occupancy = stats.total ? Math.round((stats.occupied / stats.total) * 100) : 0
  const month = monthLabel()
  const firstName = user?.name?.split(' ')[0] || 'there'

  const statCards = [
    { id: 'houses', label: 'Occupied homes', value: `${stats.occupied}/${stats.total}`, meta: `${occupancy}% occupied`, icon: Home, tab: 'houses' },
    { id: 'rent', label: 'Rent collected', value: `₹${stats.collected.toLocaleString('en-IN')}`, meta: month, icon: IndianRupee, tab: 'approvals' },
    { id: 'pending', label: 'Rent pending', value: stats.pendingHouses, meta: stats.pendingHouses ? 'Needs attention' : 'All clear', icon: AlertCircle, tab: 'approvals', urgent: stats.pendingHouses > 0 },
    { id: 'complaints', label: 'Open complaints', value: openComplaints, meta: openComplaints ? 'Needs attention' : 'No open issues', icon: Wrench, tab: 'complaints', urgent: openComplaints > 0 },
  ]

  const actions = [
    { label: 'Add / manage house', caption: 'Property setup', icon: Home, tab: 'houses' },
    { label: 'Add tenant', caption: 'Residents', icon: Users, tab: 'tenants' },
    { label: 'Review rent', caption: 'Approvals', icon: CheckCircle2, tab: 'approvals' },
    { label: 'Enter payment', caption: 'Manual entry', icon: PenSquare, tab: 'manualEntry' },
    { label: 'Create EB bill', caption: 'Electricity', icon: Zap, tab: 'eb' },
    { label: 'Create water bill', caption: 'Water', icon: Droplets, tab: 'water' },
    { label: 'Post notice', caption: 'Communication', icon: Megaphone, tab: 'notices' },
    { label: 'View reports', caption: 'Insights', icon: BarChart3, tab: 'reports' },
  ]

  return (
    <div className="rm-home space-y-5 sm:space-y-7">
      <section className="rm-home-hero">
        <div className="rm-home-hero-copy">
          <div className="rm-home-kicker"><Sparkles size={13} /> PROPERTY CONTROL CENTER</div>
          <p className="rm-home-date">{todayLabel()}</p>
          <h2>{greeting()}, {firstName}</h2>
          <p className="rm-home-subtitle">Everything important for your rental property, in one place.</p>
        </div>
        <div className="rm-home-hero-badge">
          <div className="rm-home-badge-icon"><Building2 size={19} /></div>
          <div><span>Property pulse</span><strong>{occupancy}% occupied</strong></div>
        </div>
      </section>

      <section className="rm-home-stat-grid" aria-label="Property summary">
        {statCards.map((c, i) => (
          <motion.button key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} whileTap={{ scale: .98 }} onClick={() => onNavigate(c.tab)} className={`rm-home-stat ${c.urgent ? 'is-urgent' : ''}`}>
            <div className="rm-home-stat-top"><span className="rm-home-stat-icon"><c.icon size={18} /></span><ChevronRight size={16} /></div>
            <strong>{c.value}</strong><span>{c.label}</span><small>{c.meta}</small>
          </motion.button>
        ))}
      </section>

      <section className="rm-home-section">
        <div className="rm-section-heading"><div><span className="rm-home-section-kicker">WORKFLOW</span><h3>What do you want to do?</h3></div><span className="rm-section-count">{actions.length} tools</span></div>
        <div className="rm-action-grid">
          {actions.map((a, i) => <motion.button key={a.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 + i * .035 }} whileHover={{ y: -2 }} whileTap={{ scale: .98 }} onClick={() => onNavigate(a.tab)} className="rm-action-card"><span className="rm-action-icon"><a.icon size={19} /></span><span className="rm-action-copy"><strong>{a.label}</strong><small>{a.caption}</small></span><ArrowRight size={15} className="rm-action-arrow" /></motion.button>)}
        </div>
      </section>

      <div className="rm-home-two-col">
        <section className="rm-home-panel">
          <div className="rm-section-heading"><div><span className="rm-home-section-kicker">ATTENTION</span><h3>Needs your attention</h3></div></div>
          <div className="rm-attention-list">
            <AttentionItem icon={CheckCircle2} title="Rent approvals" value={stats.pendingHouses ? `${stats.pendingHouses} house${stats.pendingHouses > 1 ? 's' : ''} pending` : 'No pending approvals'} urgent={stats.pendingHouses > 0} onClick={() => onNavigate('approvals')} />
            <AttentionItem icon={Wrench} title="Complaints" value={openComplaints ? `${openComplaints} open complaint${openComplaints > 1 ? 's' : ''}` : 'No open complaints'} urgent={openComplaints > 0} onClick={() => onNavigate('complaints')} />
            <AttentionItem icon={CalendarDays} title="Payment calendar" value="Check this month's schedule" onClick={() => onNavigate('calendar')} />
          </div>
        </section>

        <section className="rm-home-panel">
          <div className="rm-section-heading"><div><span className="rm-home-section-kicker">COMMUNICATION</span><h3>Active notices</h3></div><button className="rm-text-link" onClick={() => onNavigate('notices')}>View all <ArrowRight size={14} /></button></div>
          {notices.length ? <div className="rm-notice-list">{notices.slice(0, 3).map((n) => <button key={n.id} onClick={() => onNavigate('notices')} className="rm-notice-item"><span className="rm-notice-icon"><Bell size={16} /></span><span>{n.message}</span><ChevronRight size={15} /></button>)}</div> : <EmptyNotice onClick={() => onNavigate('notices')} />}
        </section>
      </div>

      <section className="rm-home-bottom-cta">
        <div><span className="rm-home-section-kicker">PROPERTY INSIGHTS</span><h3>Keep your rental operation organised.</h3><p>Use reports and analytics to understand collections, occupancy and day-to-day activity.</p></div>
        <button onClick={() => onNavigate('analytics')}>Open analytics <ArrowRight size={16} /></button>
      </section>
    </div>
  )
}

function AttentionItem({ icon: Icon, title, value, urgent, onClick }) {
  return <button onClick={onClick} className="rm-attention-item"><span className={`rm-attention-icon ${urgent ? 'urgent' : ''}`}><Icon size={17} /></span><span><strong>{title}</strong><small>{value}</small></span><ChevronRight size={16} /></button>
}
function EmptyNotice({ onClick }) { return <button className="rm-empty-notice" onClick={onClick}><span className="rm-notice-icon"><Megaphone size={16} /></span><span><strong>No active notices</strong><small>Post a notice when residents need an update.</small></span><ChevronRight size={15} /></button> }
function HomeSkeleton() { return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-3xl" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div><Skeleton className="h-12 w-56" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div></div> }
function greeting() { const h = new Date().getHours(); if (h < 12) return 'Good morning'; if (h < 17) return 'Good afternoon'; return 'Good evening' }
function todayLabel() { return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function monthLabel() { return new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) }
