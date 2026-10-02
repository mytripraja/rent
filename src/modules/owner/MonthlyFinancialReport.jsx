import React, { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { listHouses } from '../../services/houseService'
import { listRentHistory } from '../../services/rentService'
import { listEbBillCycles, listEbPaymentsForBill } from '../../services/ebBillService'
import { listWaterBillCycles, listWaterPaymentsForBill } from '../../services/waterBillService'
import { listExpenses } from '../../services/expenseService'
import { useToast } from '../shared/ui/Toast'

function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  return { start: new Date(year, monthNumber - 1, 1).getTime(), end: new Date(year, monthNumber, 0, 23, 59, 59, 999).getTime() }
}

function activeInMonth(entry, month) {
  const { start, end } = monthRange(month)
  const movedIn = Number(entry.movedInAt || 0)
  const movedOut = entry.movedOutAt == null ? null : Number(entry.movedOutAt)
  return movedIn <= end && (movedOut == null || movedOut >= start)
}

function money(value) { return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}` }

export default function MonthlyReport() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const toast = useToast()

  useEffect(() => { loadReport() }, [month])

  function generateMonthOptions() {
    const opts = []
    const d = new Date()
    d.setDate(1)
    for (let i = 0; i < 12; i++) {
      opts.push(d.toISOString().slice(0, 7))
      d.setMonth(d.getMonth() - 1)
    }
    return opts
  }

  async function loadReport() {
    setLoading(true)
    try {
      const houses = await listHouses()
      const houseRows = await Promise.all(houses.map(async house => {
        const [historySnap, payments] = await Promise.all([getDocs(collection(db, 'houses', house.id, 'history')), listRentHistory(house.id)])
        const history = historySnap.docs.map(d => d.data())
        const active = history.filter(p => p.month == null && activeInMonth(p, month))
        const currentHistory = active[active.length - 1]
        const expected = Number(currentHistory?.rentAmount || (house.status === 'occupied' ? house.rentAmount : 0) || 0)
        const payment = payments.find(p => p.month === month && p.status === 'approved')
        return {
          door: house.internalDoorNumber || house.govtDoorNumber || house.id,
          tenant: currentHistory?.name || house.tenantName || '—',
          expected,
          collected: Number(payment?.amount || 0),
          status: payment ? 'Paid' : expected ? 'Pending' : 'Vacant',
          date: payment?.approvedAt || payment?.dateSent || null,
        }
      }))

      const expectedRent = houseRows.reduce((sum, row) => sum + row.expected, 0)
      const collectedRent = houseRows.reduce((sum, row) => sum + row.collected, 0)
      const [ebCycles, waterCycles, expenses] = await Promise.all([
        listEbBillCycles(), listWaterBillCycles(), listExpenses(month)
      ])
      const monthCycles = cycles => cycles.filter(c => c.createdAt && new Date(c.createdAt).toISOString().slice(0, 7) === month)
      const ebMonthCycles = monthCycles(ebCycles)
      const waterMonthCycles = monthCycles(waterCycles)
      const [ebPaymentRows, waterPaymentRows] = await Promise.all([
        Promise.all(ebMonthCycles.map(c => listEbPaymentsForBill(c.id))),
        Promise.all(waterMonthCycles.map(c => listWaterPaymentsForBill(c.id))),
      ])
      const ebTotal = ebMonthCycles.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0)
      const waterTotal = waterMonthCycles.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0)
      const ebCollected = ebPaymentRows.flat().filter(p => p.status === 'approved').reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const waterCollected = waterPaymentRows.flat().filter(p => p.status === 'approved').reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const expenseTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

      setReport({
        expectedRent, collectedRent, pendingRent: Math.max(0, expectedRent - collectedRent),
        collectionRate: expectedRent ? Math.round((collectedRent / expectedRent) * 100) : 0,
        houseBreakdown: houseRows, ebTotal, ebCollected, waterTotal, waterCollected, expenseTotal,
        netIncome: collectedRent - expenseTotal,
      })
    } catch (err) {
      console.error(err)
      toast.error('Could not generate the report. Please try again.')
    } finally { setLoading(false) }
  }

  if (loading) return <div className="p-4 text-sm text-ink-soft">Loading report…</div>
  if (!report) return null

  return (
    <div className="space-y-6 print:space-y-4 max-w-4xl mx-auto">
      <style>{`@media print { body * { visibility:hidden } #printable-report,#printable-report * { visibility:visible } #printable-report { position:absolute;left:0;top:0;width:100%;padding:20px }.no-print{display:none!important} }`}</style>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-paper-raised p-4 rounded-xl border border-brass/20 shadow-sm no-print">
        <div><h2 className="font-semibold text-ink">Monthly report</h2><p className="text-xs text-ink-soft mt-0.5">Rent, utilities and expenses for the selected month.</p></div>
        <div className="flex gap-2"><select value={month} onChange={e => setMonth(e.target.value)} className="border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper">{generateMonthOptions().map(m => <option key={m} value={m}>{m}</option>)}</select><button onClick={() => window.print()} className="bg-cover text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1"><Printer size={16}/> Print</button></div>
      </div>

      <div id="printable-report" className="space-y-6">
        <div className="text-center hidden print:block mb-6"><h1 className="text-2xl font-bold text-ink">MONTHLY REPORT</h1><p className="text-ink-soft mt-1">{month}</p></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['Expected rent',report.expectedRent,'text-ink'],['Rent collected',report.collectedRent,'text-stamp-green'],['Pending rent',report.pendingRent,'text-stamp-red'],['Collection rate',`${report.collectionRate}%`,'text-ink']].map(([label,value,cls]) => <div key={label} className="bg-paper-raised p-4 rounded-xl border border-brass/20"><p className="text-xs text-ink-soft uppercase tracking-wider">{label}</p><p className={`text-2xl font-bold ${cls} mt-1`}>{typeof value === 'string' ? value : money(value)}</p></div>)}
        </div>

        <div className="bg-paper-raised rounded-xl border border-brass/20 overflow-hidden"><div className="p-4 border-b border-brass/20"><h3 className="font-semibold text-ink">House-wise rent</h3></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-ink-soft uppercase bg-paper"><tr>{['Door','Tenant','Expected','Collected','Status','Paid'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-brass/10">{report.houseBreakdown.map(h=><tr key={h.door}><td className="px-4 py-3 font-medium">{h.door}</td><td className="px-4 py-3">{h.tenant}</td><td className="px-4 py-3">{money(h.expected)}</td><td className="px-4 py-3">{money(h.collected)}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${h.status==='Paid'?'bg-green-100 text-green-800':h.status==='Pending'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-600'}`}>{h.status}</span></td><td className="px-4 py-3">{h.date ? new Date(h.date).toLocaleDateString('en-IN') : '—'}</td></tr>)}</tbody></table></div></div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-paper-raised p-4 rounded-xl border border-brass/20 space-y-3"><h3 className="font-semibold text-ink border-b border-brass/20 pb-2">Utilities</h3><div className="flex justify-between text-sm"><span className="text-ink-soft">EB billed / collected</span><span className="font-medium">{money(report.ebTotal)} / {money(report.ebCollected)}</span></div><div className="flex justify-between text-sm"><span className="text-ink-soft">Water billed / collected</span><span className="font-medium">{money(report.waterTotal)} / {money(report.waterCollected)}</span></div><div className="flex justify-between text-sm"><span className="text-ink-soft">Expenses</span><span className="font-medium text-stamp-red">− {money(report.expenseTotal)}</span></div></div>
          <div className="bg-paper-raised p-4 rounded-xl border border-brass/20 flex flex-col justify-center"><p className="text-xs text-center text-ink-soft uppercase tracking-wider">Operating result</p><p className="text-4xl font-display font-bold text-center text-cover mt-1">{money(report.netIncome)}</p><p className="text-xs text-center text-ink-soft mt-1">Rent collected minus expenses. Utility collections are shown separately.</p></div>
        </div>
      </div>
    </div>
  )
}
