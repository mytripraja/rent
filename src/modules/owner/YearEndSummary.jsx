import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { getYearSummary } from '../../services/analyticsService'
import { useToast } from '../shared/ui/Toast'

function money(value) { return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}` }

export default function YearEndSummary() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let active = true
    setLoading(true)
    getYearSummary(year).then(result => {
      if (active) setData(result)
    }).catch(error => {
      console.error(error)
      if (active) toast.error('Could not load the annual summary. Please try again.')
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [year])

  if (loading) return <div className="p-4 text-sm text-ink-soft">Loading annual summary…</div>
  if (!data) return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 print:hidden">
        <div><h2 className="text-lg font-semibold text-ink">Year-end summary</h2><p className="text-sm text-ink-soft">Actual rent, expenses, utilities and resident activity for {year}.</p></div>
        <div className="flex gap-2"><select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-brass/30 rounded-lg px-3 py-2 text-sm bg-white">{[currentYear,currentYear-1,currentYear-2].map(y => <option key={y}>{y}</option>)}</select><button onClick={() => window.print()} className="p-2 bg-paper rounded-lg border border-brass/30 text-ink hover:bg-paper-raised" aria-label="Print annual report"><Printer size={18}/></button></div>
      </div>

      <div id="annual-report" className="space-y-6">
        <div className="hidden print:block mb-6"><h1 className="text-2xl font-bold text-ink">Annual report — {year}</h1><p className="text-sm text-ink-soft mt-1">Generated {new Date().toLocaleDateString('en-IN')}</p></div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Rent expected" value={money(data.annualRentExpected)} />
          <Stat label="Rent collected" value={money(data.annualRentCollected)} tone="green" />
          <Stat label="Expenses" value={money(data.annualExpenses)} tone="red" />
          <Stat label="Operating result" value={money(data.netOperatingResult)} tone={data.netOperatingResult >= 0 ? 'green' : 'red'} />
          <Stat label="Occupancy" value={`${data.occupancyRate}%`} />
          <Stat label="EB collected" value={money(data.ebCollected)} />
          <Stat label="Water collected" value={money(data.waterCollected)} />
          <Stat label="Complaints resolved" value={`${data.resolvedComplaints}/${data.totalComplaints}`} />
        </div>

        <div className="bg-paper-raised border border-brass/20 rounded-xl overflow-hidden">
          <div className="px-4 py-4 border-b border-brass/20"><h3 className="font-semibold text-ink">House-wise rent</h3><p className="text-xs text-ink-soft mt-1">Collected amounts are based on approved payments recorded in the selected year.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-paper text-xs text-ink-soft uppercase"><tr>{['House','Resident','Expected','Collected','Occupied months','Unpaid months'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-brass/10">{data.perHouse.map(row=><tr key={row.houseId}><td className="px-4 py-3 font-medium">{row.doorNumber}</td><td className="px-4 py-3">{row.name}</td><td className="px-4 py-3">{money(row.expected)}</td><td className="px-4 py-3 text-stamp-green">{money(row.collected)}</td><td className="px-4 py-3">{row.occupiedMonths}</td><td className={`px-4 py-3 ${row.unpaidMonths ? 'text-stamp-red font-medium' : 'text-ink-soft'}`}>{row.unpaidMonths}</td></tr>)}</tbody></table></div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <Info label="EB bill cycles" value={data.ebCycleCount} note={`${money(data.ebCollected)} collected`} />
          <Info label="Water bill cycles" value={data.waterCycleCount} note={`${money(data.waterCollected)} collected`} />
          <Info label="Complaint resolution" value={data.totalComplaints ? `${Math.round(data.resolvedComplaints / data.totalComplaints * 100)}%` : '—'} note={`${data.resolvedComplaints} resolved`} />
        </div>
      </div>

      <style>{`@media print { body * { visibility:hidden } #annual-report,#annual-report * { visibility:visible } #annual-report { position:absolute;left:0;top:0;width:100%;padding:20px } }`}</style>
    </div>
  )
}

function Stat({ label, value, tone }) {
  const toneClass = tone === 'green' ? 'text-stamp-green' : tone === 'red' ? 'text-stamp-red' : 'text-ink'
  return <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl"><p className="text-xs text-ink-soft uppercase mb-1">{label}</p><p className={`text-xl font-semibold ${toneClass}`}>{value}</p></div>
}

function Info({ label, value, note }) {
  return <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl"><p className="text-xs text-ink-soft uppercase">{label}</p><p className="font-display text-2xl font-bold text-ink mt-1">{value}</p><p className="text-xs text-ink-soft mt-1">{note}</p></div>
}
