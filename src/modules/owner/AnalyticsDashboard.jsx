import { useEffect, useState } from 'react'
import { getAnalyticsData } from '../../services/analyticsService'
import { TrendingUp, Users, DollarSign, Clock } from 'lucide-react'

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAnalyticsData().then(d => {
      setData(d)
      setLoading(false)
    }).catch(console.error)
  }, [])

  if (loading || !data) return <div className="p-8 text-center text-ink-soft">Loading analytics...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Analytics Dashboard</h2>
        <p className="text-sm text-ink-soft">Performance and trends over time.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-paper-raised rounded-2xl border border-brass/20 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-ink-soft mb-1"><DollarSign size={16} /> <span className="text-xs font-medium uppercase">Expected Rent</span></div>
          <p className="text-2xl font-semibold text-ink">₹{data.currentExpected.toLocaleString()}</p>
          <p className="text-xs text-stamp-green flex items-center gap-1 mt-1"><TrendingUp size={12}/> Stable</p>
        </div>
        <div className="bg-paper-raised rounded-2xl border border-brass/20 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-ink-soft mb-1"><TrendingUp size={16} /> <span className="text-xs font-medium uppercase">3 Mo Projection</span></div>
          <p className="text-2xl font-semibold text-ink">₹{data.projected.toLocaleString()}</p>
          <p className="text-xs text-ink-soft mt-1">Based on current occupancy</p>
        </div>
      </div>

      <div className="bg-paper-raised rounded-2xl border border-brass/20 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink mb-4">Occupancy History (Last 12 Months)</h3>
        <div className="h-40 flex items-end gap-2">
          {data.occupancyHistory.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-paper rounded-t-sm h-full flex items-end">
                <div 
                  className="w-full bg-stamp-green rounded-t-sm transition-all" 
                  style={{ height: `${d.rate}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-ink-soft font-mono">{d.month}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-paper-raised rounded-2xl border border-brass/20 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Users size={16}/> Tenant Reliability</h3>
          <div className="space-y-3">
            {data.tenantScores.sort((a,b) => b.score - a.score).slice(0,5).map(t => (
              <div key={t.houseId} className="flex justify-between items-center text-sm">
                <span className="text-ink">House {t.doorNumber} ({t.name})</span>
                <span className={`font-medium px-2 py-0.5 rounded text-xs ${t.score >= 80 ? 'bg-stamp-green/10 text-stamp-green' : t.score >= 50 ? 'bg-stamp-amber/10 text-stamp-amber' : 'bg-stamp-red/10 text-stamp-red'}`}>
                  {t.score}/100
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-paper-raised rounded-2xl border border-brass/20 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Clock size={16}/> Payment Delays</h3>
          <div className="space-y-3">
            {data.delayPatterns.sort((a,b) => b.avgDays - a.avgDays).slice(0,5).map(t => (
              <div key={t.houseId} className="flex justify-between items-center text-sm border-b border-brass/10 last:border-0 pb-1.5 last:pb-0">
                <span className="text-ink">House {t.doorNumber}</span>
                <div className="text-right">
                  <p className="font-medium text-ink">{t.avgDays} days avg</p>
                  <p className="text-[10px] text-ink-soft">{t.consecutiveOnTime} on-time</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
