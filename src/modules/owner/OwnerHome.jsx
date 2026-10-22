import { useEffect, useState } from 'react'
import { ArrowRight, Bell, CalendarDays, ChartNoAxesColumn, CircleAlert, CircleCheck, FileText, Megaphone, Plus, Upload, Wallet, Wrench } from 'lucide-react'
import { listHouses } from '../../services/houseService'
import { listRentHistory, currentMonthStr } from '../../services/rentService'
import { listActiveNoticesForHouses } from '../../services/noticeService'
import { listAllComplaints } from '../../services/complaintService'
import { listAllRequests } from '../../services/maintenanceService'
import { useAuth } from '../../context/AuthContext'
import { Skeleton } from '../shared/ui/Skeleton'

const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`

export default function OwnerHome({ onNavigate }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const houses = await listHouses()
      const occupied = houses.filter(h => h.status === 'occupied')
      const month = currentMonthStr()
      // Rent history is supplementary to the house directory. If one legacy
      // house has a stale rule or missing payment access, keep the dashboard
      // usable and calculate the remaining cards from the records we can read.
      const historyResults = await Promise.allSettled(occupied.map(h => listRentHistory(h.id)))
      const historyIncomplete = historyResults.some(result => result.status === 'rejected')
      historyResults.forEach((result, index) => {
        if (result.status === 'rejected') console.warn(`Rent history unavailable for house ${occupied[index]?.id}`, result.reason)
      })
      const payments = historyResults.flatMap(result => result.status === 'fulfilled' ? result.value : [])
      const expected = occupied.reduce((sum, house) => sum + Number(house.rentAmount || 0), 0)
      const received = payments.filter(p => p.month === month && p.status === 'approved').reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const pending = payments.filter(p => p.month === month && p.status === 'waiting_approval')
      const pendingAmount = pending.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const pendingHouseIds = new Set(pending.map(p => p.houseId))
      const needsAttention = occupied.filter(h => {
        const paid = payments.some(p => p.houseId === h.id && p.month === month && p.status === 'approved')
        return !paid && !pendingHouseIds.has(h.id)
      }).slice(0, 4)
      const optionalReads = await Promise.allSettled([
        listActiveNoticesForHouses(houses.map(h => h.id)),
        listAllComplaints(houses.map(h => h.id), houses[0]?.propertyId || null),
        listAllRequests('all', houses.map(h => h.id)),
      ])
      const [notices, complaints, maintenance] = optionalReads.map(result => {
        if (result.status === 'fulfilled') return result.value
        console.warn('Optional dashboard information is unavailable', result.reason)
        return []
      })
      const current = new Date()
      const months = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(current.getFullYear(), current.getMonth() - 6 + index, 1)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return { key, label: date.toLocaleDateString('en-IN', { month: 'short' }), amount: payments.filter(p => p.month === key && p.status === 'approved').reduce((sum, p) => sum + Number(p.amount || 0), 0) }
      })
      const activity = [
        ...payments.map(p => ({ id: `rent-${p.id}`, type: 'rent', title: `${p.houseId ? `${houses.find(h => h.id === p.houseId)?.internalDoorNumber || 'House'} · ` : ''}Rent ${p.status === 'approved' ? 'approved' : p.status === 'waiting_approval' ? 'submitted for review' : 'updated'}`, detail: `${p.month || month} · ${money(p.amount)}${p.mode ? ` · ${p.mode}` : ''}`, time: Number(p.updatedAt || p.createdAt || p.timestamp || 0), action: p.status === 'waiting_approval' ? 'Review' : 'Payment history', route: p.status === 'waiting_approval' ? 'approvals' : 'reports' })),
        ...notices.map(n => ({ id: `notice-${n.id}`, type: 'notice', title: 'Notice published', detail: n.message || n.title || 'Resident announcement', time: Number(n.createdAt || n.timestamp || 0), action: 'View notice', route: 'notices' })),
      ].sort((a, b) => b.time - a.time).slice(0, 5)
      setData({ houses, occupied, expected, received, outstanding: Math.max(expected - received, 0), historyIncomplete, pendingAmount, pendingCount: pending.length, needsAttention, notices, openIssues: maintenance.filter(request => request.status === 'open' || request.status === 'in_progress').length + complaints.filter(c => c.status === 'open').length, months, activity, month })
    } catch (err) {
      console.error(err)
      setError(err)
    } finally { setLoading(false) }
  }

  if (loading) return <DashboardSkeleton />
  if (error) return <div className="rm-empty-state"><p>We couldn’t load your property overview.</p><button onClick={load} className="rm-primary-button">Try again</button></div>
  if (!data) return null

  const maxBar = Math.max(...data.months.map(item => item.amount), 1)
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const actionRows = [
    { icon: Plus, label: 'Add payment', route: 'manualEntry', primary: true },
    { icon: Upload, label: 'Manual entry', route: 'manualEntry' },
    { icon: FileText, label: 'Add bill', route: 'eb' },
    { icon: Plus, label: 'Add tenant', route: 'houses' },
  ]

  return <div className="rm-dashboard">
    <section className="rm-page-heading">
      <div><h1>Good {greeting()}, {user?.name?.split(' ')[0] || 'there'}</h1><p>Your property, at a glance · {data.houses.length} houses · {data.occupied.length} occupied · {data.houses.length - data.occupied.length} vacant</p></div>
      <button className="rm-month-picker" type="button" aria-label={`Selected month ${monthLabel}`}><span>{monthLabel}</span><CalendarDays size={15}/></button>
    </section>

    {data.historyIncomplete && <div className="rm-data-note" role="status">Some rent history could not be read. Collection totals and approval counts are hidden until the records are available.</div>}

    <section className="rm-summary-grid" aria-label="Monthly rent summary">
      <Summary label="Expected rent" value={money(data.expected)} detail={`${monthLabel} · ${data.occupied.length} occupied houses`} />
      <Summary label="Rent received" value={data.historyIncomplete ? '—' : money(data.received)} detail={data.historyIncomplete ? 'Payment history unavailable' : data.expected ? `${Math.round(data.received / data.expected * 100)}% collected` : 'No active rent this month'} />
      <Summary label="Outstanding rent" value={data.historyIncomplete ? '—' : money(data.outstanding)} detail={data.historyIncomplete ? 'Payment history unavailable' : data.pendingAmount ? `Includes ${money(data.pendingAmount)} pending approval` : 'Approved payments deducted'} />
    </section>

    <section className="rm-dashboard-grid rm-dashboard-grid-primary">
      <div className="rm-panel rm-collection-panel">
        <div className="rm-panel-heading"><div><h2>Rent collection</h2><p>Received as a share of expected rent</p></div><button className="rm-inline-link" onClick={() => onNavigate('reports')}>View report <ArrowRight size={14}/></button></div>
        <div className="rm-chart-heading"><span>{monthLabel}</span><strong>{data.historyIncomplete ? 'Unavailable' : `${data.expected ? Math.round(data.received / data.expected * 100) : 0}% collected`}</strong></div>
        <div className="rm-collection-chart" role="img" aria-label={data.historyIncomplete ? 'Rent history unavailable' : `Rent received for seven months, current collection ${money(data.received)}`}>
          {data.historyIncomplete ? <span className="rm-chart-unavailable">Payment history unavailable</span> : data.months.map(item => <div className="rm-chart-column" key={item.key}><div className={`rm-chart-bar ${item.key === data.month ? 'is-current' : ''}`} style={{ height: `${Math.max(item.amount ? item.amount / maxBar * 100 : 0, 8)}%` }} title={`${item.label}: ${money(item.amount)}`}/><span>{item.label}</span></div>)}
        </div>
        <p className="rm-chart-note">{data.historyIncomplete ? 'The chart will return when rent history access is restored.' : `${money(data.received)} collected in approved rent this month.`}</p>
      </div>

      <div className="rm-panel rm-attention-panel">
        <div className="rm-panel-heading"><div><h2>Needs your attention</h2><p>{data.pendingCount + data.needsAttention.length + data.openIssues} items need a look</p></div></div>
        {data.historyIncomplete ? <p className="rm-attention-unavailable">Rent approvals and overdue follow-ups are hidden until payment history access is restored.</p> : <>
          {data.pendingCount > 0 && <div className="rm-approval-summary"><div><strong>{data.pendingCount} rent submission{data.pendingCount === 1 ? '' : 's'} · {money(data.pendingAmount)}</strong><small>Waiting for owner review</small></div><button onClick={() => onNavigate('approvals')}>Approve rent</button></div>}
          <div className="rm-attention-list">
            {data.needsAttention.slice(0, 3).map(h => <button key={h.id} className="rm-attention-row" onClick={() => onNavigate('houses')}><span className="rm-attention-icon"><CircleAlert size={15}/></span><span><strong>{h.internalDoorNumber} · {h.tenantName || 'Tenant'}</strong><small>{money(h.rentAmount)} rent not yet approved</small></span><ArrowRight size={15}/></button>)}
            {data.openIssues > 0 && <button className="rm-attention-row" onClick={() => onNavigate('maintenance')}><span className="rm-attention-icon"><Wrench size={15}/></span><span><strong>{data.openIssues} open maintenance request{data.openIssues === 1 ? '' : 's'}</strong><small>Review resident issues</small></span><ArrowRight size={15}/></button>}
            {!data.pendingCount && !data.needsAttention.length && !data.openIssues && <div className="rm-attention-clear"><CircleCheck size={17}/> Everything is up to date.</div>}
          </div>
        </>}
        {data.notices.length > 0 && <div className="rm-attention-foot"><span>Latest notice</span><strong>{data.notices[0].title || data.notices[0].message || 'Resident announcement'}</strong></div>}
      </div>
    </section>

    <section className="rm-dashboard-grid rm-dashboard-grid-secondary">
      <div className="rm-panel rm-activity-panel">
        <div className="rm-panel-heading"><h2>Recent activity</h2><button className="rm-inline-link" onClick={() => onNavigate('reports')}>View all <ArrowRight size={14}/></button></div>
        {data.activity.length ? <div className="rm-activity-list">{data.activity.map(item => <div className="rm-activity-row" key={item.id}><span className={`rm-activity-icon ${item.type}`} aria-hidden="true">{item.type === 'notice' ? <Megaphone size={15}/> : <Wallet size={15}/>}</span><span className="rm-activity-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><button onClick={() => onNavigate(item.route)}>{item.action} <ArrowRight size={13}/></button></div>)}</div> : <div className="rm-attention-clear"><Bell size={17}/> No recent activity yet.</div>}
      </div>
      <div className="rm-panel rm-quick-panel">
        <div className="rm-panel-heading"><h2>Quick actions</h2></div>
        <div className="rm-quick-actions">{actionRows.map(({ icon: Icon, label, route, primary }) => <button key={label} onClick={() => onNavigate(route)} className={primary ? 'is-primary' : ''}><Icon size={15}/>{label}</button>)}</div>
        {data.openIssues > 0 && <button className="rm-quick-maintenance" onClick={() => onNavigate('maintenance')}><Wrench size={14}/> {data.openIssues} maintenance request{data.openIssues === 1 ? '' : 's'} open <ArrowRight size={13}/></button>}
      </div>
    </section>
  </div>
}

function Summary({ label, value, detail }) { return <article className="rm-summary-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }
function DashboardSkeleton() { return <div className="rm-dashboard"><Skeleton className="h-16 w-full rounded-xl"/><div className="grid md:grid-cols-3 gap-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl"/>)}</div><Skeleton className="h-64 rounded-xl"/></div> }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening' }
