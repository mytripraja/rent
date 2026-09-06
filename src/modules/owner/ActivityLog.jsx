import { useEffect, useState } from 'react'
import { listActivities } from '../../services/activityLogService'
import { FileText, Home, DollarSign, Bell, MessageSquareWarning, Settings, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const ICON_MAP = {
  rent: DollarSign,
  house: Home,
  tenant: FileText,
  notice: Bell,
  complaint: MessageSquareWarning,
  eb_bill: Zap,
  expense: DollarSign,
  settings: Settings
}

export default function ActivityLog() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await listActivities(100)
      setActivities(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all' ? activities : activities.filter(a => a.entityType === filter)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">Activity Log</h2>
          <p className="text-sm text-ink-soft">Audit trail of all actions.</p>
        </div>
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)}
          className="border border-brass/30 rounded-lg px-3 py-1.5 text-sm bg-paper-raised"
        >
          <option value="all">All Activities</option>
          <option value="rent">Rent</option>
          <option value="house">Houses</option>
          <option value="notice">Notices</option>
          {/* Add more types as needed */}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-ink-soft">Loading activity log...</div>
      ) : (
        <div className="bg-paper-raised border border-brass/20 rounded-2xl p-4 shadow-sm">
          <div className="space-y-4">
            {filtered.map(act => {
              const Icon = ICON_MAP[act.entityType] || FileText
              return (
                <div key={act.id} className="flex gap-3 items-start border-b border-brass/10 pb-3 last:border-0 last:pb-0">
                  <div className="mt-1 p-1.5 bg-paper rounded-full border border-brass/20 text-ink-soft">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-ink">
                      <span className="font-medium">{act.performedByName || 'System'}</span>{' '}
                      {act.action} {act.entityType}
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">{act.details}</p>
                    <p className="text-[10px] text-brass mt-1">
                      {act.timestamp ? formatDistanceToNow(act.timestamp, { addSuffix: true }) : ''}
                    </p>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <p className="text-sm text-ink-soft py-4 text-center">No activity found.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
