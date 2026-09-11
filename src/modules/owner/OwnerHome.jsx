import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, AlertCircle, Users, IndianRupee, Bell, ArrowUpRight, CheckCircle2, ReceiptIndianRupee, UserRoundPlus, Megaphone, Zap, ChevronRight } from 'lucide-react'
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

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const houses = await listHouses()
      const occupied = houses.filter(h => h.status === 'occupied')
      setHousePulse(houses)
      const month = currentMonthStr()
      let collected = 0; let pendingHouses = 0; let pendingApprovals = 0
      const paymentsList = await Promise.all(occupied.map(h => listRentHistory(h.id)))
      occupied.forEach((h, index) => {
        const payments = paymentsList[index]
        const status = resolveMonthStatus(payments, month)
        const monthPayments = payments.filter(p => p.month === month)
        collected += monthPayments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        if (status === 'waiting_approval') pendingApprovals++
        if (status !== 'paid' || countMonthsPending(payments) > 0) pendingHouses++
      })
      setStats({ occupied: occupied.length, vacant: houses.length - occupied.length, collected, pendingHouses, pendingApprovals, total: houses.length })
      setNotices(await listActiveNotices())
      const complaints = await listAllComplaints()
      setOpenComplaints(complaints.filter(c => c.status === 'open').length)
    } catch (err) { console.error(err); setError(err) } finally { setLoading(false) }
  }

  if (loading) return <OwnerHomeSkeleton />
  if (error) return <div className="dashboard-error"><AlertCircle size={22} /><div><strong>We couldn't load your property overview.</strong><p>Check your connection and try again.</p><button onClick={load}>Retry</button></div></div>
  if (!stats) return null

  const month = monthLabel()
  const attentionCount = stats.pendingApprovals + openComplaints
  const occupancy = stats.total ? Math.round((stats.occupied / stats.total) * 100) : 0

  const statCards = [
    { label: 'Collected this month', value: `₹${stats.collected.toLocaleString('en-IN')}`, meta: month, icon: IndianRupee, tone: 'gold', onClick: () => onNavigate('approvals') },
    { label: 'Occupancy', value: `${occupancy}%`, meta: `${stats.occupied} of ${stats.total} homes occupied`, icon: Home, tone: 'green', onClick: () => onNavigate('houses') },
    { label: 'Rent approvals', value: stats.pendingApprovals, meta: stats.pendingApprovals ? 'Waiting for your review' : 'All caught up', icon: CheckCircle2, tone: stats.pendingApprovals ? 'amber' : 'green', onClick: () => onNavigate('approvals') },
    { label: 'Open complaints', value: openComplaints, meta: openComplaints ? 'Needs attention' : 'Nothing pending', icon: AlertCircle, tone: openComplaints ? 'red' : 'green', onClick: () => onNavigate('complaints') },
  ]

  return (
    <div className="owner-dashboard-home">
      <section className="dashboard-hero">
        <div>
          <div className="dashboard-kicker">{todayLabel()}</div>
          <h2>{greeting()}, {user?.name?.split(' ')[0] || 'there'} <span>✦</span></h2>
          <p>Here is what needs your attention across the property today.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => onNavigate('manualEntry')} className="hero-secondary"><ReceiptIndianRupee size={17} /> Record payment</button>
          <button onClick={() => onNavigate('notices')} className="hero-primary"><Megaphone size={17} /> Post notice</button>
        </div>
      </section>

      <section className="dashboard-stat-grid" aria-label="Property summary">
        {statCards.map((card, i) => <motion.button key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} onClick={card.onClick} className={`dashboard-stat-card tone-${card.tone}`}>
          <div className="stat-top"><span className="stat-icon"><card.icon size={18} /></span><ArrowUpRight size={16} className="stat-arrow" /></div>
          <div className="stat-value">{card.value}</div>
          <div className="stat-label">{card.label}</div>
          <div className="stat-meta">{card.meta}</div>
        </motion.button>)}
      </section>

      <div className="dashboard-main-grid">
        <section className="dashboard-panel property-panel">
          <div className="panel-heading"><div><div className="panel-eyebrow">Your property</div><h3>Homes at a glance</h3></div><button onClick={() => onNavigate('houses')} className="panel-link">View all <ArrowUpRight size={15} /></button></div>
          <div className="house-grid">
            {housePulse.map(h => {
              const occupied = h.status === 'occupied'
              return <button key={h.id} onClick={() => onNavigate('houses')} className={`house-tile ${occupied ? 'is-occupied' : 'is-vacant'}`}>
                <div className="house-number">{h.internalDoorNumber}</div>
                <div className="house-status"><span className="status-dot" />{occupied ? 'Occupied' : 'Vacant'}</div>
                <ChevronRight size={16} className="house-chevron" />
              </button>
            })}
          </div>
          <div className="property-footer"><span><b>{stats.occupied}</b> occupied</span><span><b>{stats.vacant}</b> vacant</span><span><b>{stats.pendingHouses}</b> with pending rent</span></div>
        </section>

        <section className="dashboard-panel attention-panel">
          <div className="panel-heading"><div><div className="panel-eyebrow">Action centre</div><h3>Needs your attention</h3></div><span className={`attention-count ${attentionCount ? 'has-items' : ''}`}>{attentionCount}</span></div>
          {attentionCount ? <div className="attention-list">
            {stats.pendingApprovals > 0 && <button onClick={() => onNavigate('approvals')} className="attention-row"><span className="attention-icon amber"><CheckCircle2 size={18} /></span><span><b>{stats.pendingApprovals} rent {stats.pendingApprovals === 1 ? 'payment' : 'payments'}</b><small>Waiting for approval and receipt</small></span><ChevronRight size={17} /></button>}
            {openComplaints > 0 && <button onClick={() => onNavigate('complaints')} className="attention-row"><span className="attention-icon red"><AlertCircle size={18} /></span><span><b>{openComplaints} open {openComplaints === 1 ? 'complaint' : 'complaints'}</b><small>Review and respond</small></span><ChevronRight size={17} /></button>}
          </div> : <div className="empty-attention"><div className="empty-check"><CheckCircle2 size={23} /></div><b>Everything is under control</b><p>No approvals or complaints need your attention right now.</p></div>}
        </section>
      </div>

      <div className="dashboard-lower-grid">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><div className="panel-eyebrow">Shortcuts</div><h3>Common actions</h3></div></div>
          <div className="action-grid">
            <Action icon={UserRoundPlus} title="Add tenant" text="Create a tenant account" onClick={() => onNavigate('tenants')} />
            <Action icon={ReceiptIndianRupee} title="Manual payment" text="Record cash or bank payment" onClick={() => onNavigate('manualEntry')} />
            <Action icon={Zap} title="Create EB bill" text="Prepare the next electricity bill" onClick={() => onNavigate('eb')} />
            <Action icon={Bell} title="Send reminder" text="Follow up on pending rent" onClick={() => onNavigate('reminders')} />
          </div>
        </section>

        <section className="dashboard-panel notices-panel">
          <div className="panel-heading"><div><div className="panel-eyebrow">Communication</div><h3>Active notices</h3></div><button onClick={() => onNavigate('notices')} className="panel-link">Manage <ArrowUpRight size={15} /></button></div>
          {notices.length ? <div className="notice-list">{notices.slice(0, 3).map(n => <div className="notice-item" key={n.id}><span className="notice-mark" /><div><b>{n.title || 'Property notice'}</b><p>{n.message}</p></div></div>)}</div> : <div className="empty-notices"><Bell size={18} /><span>No active notices.</span><button onClick={() => onNavigate('notices')}>Create one</button></div>}
        </section>
      </div>
    </div>
  )
}

function Action({ icon: Icon, title, text, onClick }) {
  return <button className="dashboard-action" onClick={onClick}><span className="action-icon"><Icon size={18} /></span><span><b>{title}</b><small>{text}</small></span><ChevronRight size={16} /></button>
}

function OwnerHomeSkeleton() {
  return <div className="owner-dashboard-home"><div className="skeleton-hero"><Skeleton className="h-3 w-28 mb-3" /><Skeleton className="h-9 w-72 mb-2" /><Skeleton className="h-4 w-96" /></div><div className="dashboard-stat-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div><div className="dashboard-main-grid"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div></div>
}

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
function todayLabel() { return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) }
function monthLabel() { return new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) }
