import { useState, useEffect } from 'react'
import { getAnalyticsData } from '../../services/analyticsService'
import { Printer } from 'lucide-react'

export default function YearEndSummary() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState(null)
  
  useEffect(() => {
    // We reuse analytics service mock for now. In real app, it would query past year's exact numbers
    getAnalyticsData().then(setData)
  }, [year])

  if (!data) return <div className="text-sm text-ink-soft">Loading summary...</div>

  // Mocked annual breakdown
  const annualRent = data.currentExpected * 12
  const annualExpenses = annualRent * 0.15 // 15% expenses
  const netProfit = annualRent - annualExpenses
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-ink">Year-End Summary</h2>
          <p className="text-sm text-ink-soft">Financials and property health.</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-brass/30 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear - 2}>{currentYear - 2}</option>
          </select>
          <button onClick={() => window.print()} className="p-1.5 bg-paper rounded border border-brass/30 text-ink hover:bg-paper-raised">
            <Printer size={18} />
          </button>
        </div>
      </div>

      <div className="print:block hidden mb-6">
        <h1 className="text-2xl font-bold text-ink">Annual Report {year}</h1>
        <p className="text-ink-soft">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl">
          <p className="text-xs text-ink-soft uppercase mb-1">Total Rent</p>
          <p className="text-xl font-semibold text-ink">₹{annualRent.toLocaleString()}</p>
        </div>
        <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl">
          <p className="text-xs text-ink-soft uppercase mb-1">Total Expenses</p>
          <p className="text-xl font-semibold text-stamp-red">₹{annualExpenses.toLocaleString()}</p>
        </div>
        <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl">
          <p className="text-xs text-ink-soft uppercase mb-1">Net Profit</p>
          <p className="text-xl font-semibold text-stamp-green">₹{netProfit.toLocaleString()}</p>
        </div>
        <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl">
          <p className="text-xs text-ink-soft uppercase mb-1">Occupancy Rate</p>
          <p className="text-xl font-semibold text-ink">{data.occupancyHistory[11].rate}%</p>
        </div>
        <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl">
          <p className="text-xs text-ink-soft uppercase mb-1">EB Bills Generated</p>
          <p className="text-xl font-semibold text-ink">6 cycles</p>
        </div>
        <div className="bg-paper-raised border border-brass/20 p-4 rounded-xl">
          <p className="text-xs text-ink-soft uppercase mb-1">Complaints Resolved</p>
          <p className="text-xl font-semibold text-ink">14</p>
        </div>
      </div>

      <div className="bg-paper-raised border border-brass/20 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-brass/20 bg-paper">
          <h3 className="font-semibold text-ink text-sm">Per-House Annual Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-paper text-xs text-ink-soft uppercase border-b border-brass/10">
              <tr>
                <th className="px-4 py-2 font-medium">House</th>
                <th className="px-4 py-2 font-medium">Tenant</th>
                <th className="px-4 py-2 font-medium">Rent Collected</th>
                <th className="px-4 py-2 font-medium">Delays</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brass/10">
              {data.tenantScores.map(t => (
                <tr key={t.houseId} className="hover:bg-paper/50">
                  <td className="px-4 py-2 font-medium text-ink">{t.doorNumber}</td>
                  <td className="px-4 py-2 text-ink-soft">{t.name}</td>
                  <td className="px-4 py-2 text-ink">₹{(annualRent / data.tenantScores.length).toLocaleString()}</td>
                  <td className="px-4 py-2 text-ink-soft">{Math.floor(Math.random() * 3)} times</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
