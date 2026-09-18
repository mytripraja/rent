import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { listHouses } from '../../services/houseService'
import { resolveMonthStatus } from '../../services/rentService'
import { useToast } from '../shared/ui/Toast'
import LoadingScreen from '../shared/LoadingScreen'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function PaymentCalendar() {
  const [loading, setLoading] = useState(true)
  const [houses, setHouses] = useState([])
  const [gridData, setGridData] = useState({})
  const [selectedCell, setSelectedCell] = useState(null)
  const toast = useToast()

  const year = new Date().getFullYear()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const hList = await listHouses()
      setHouses(hList)

      const rentSnap = await getDocs(collection(db, 'rentPayments'))
      const allRents = rentSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const data = {}
      hList.forEach(h => {
        data[h.id] = {}
        const houseRents = allRents.filter(r => r.houseId === h.id)
        
        for (let m = 1; m <= 12; m++) {
          const monthStr = `${year}-${String(m).padStart(2, '0')}`
          const status = resolveMonthStatus(houseRents, monthStr)
          
          const rentsForMonth = houseRents.filter(r => r.month === monthStr)
          let finalStatus = status
          if (h.status === 'vacant' && rentsForMonth.length === 0) {
            finalStatus = 'vacant'
          }
          data[h.id][monthStr] = {
            status: finalStatus,
            rents: rentsForMonth
          }
        }
      })
      setGridData(data)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'paid': return 'bg-stamp-green'
      case 'waiting_approval': return 'bg-stamp-amber'
      case 'not_paid': return 'bg-stamp-red'
      case 'vacant': return 'bg-black/10'
      default: return 'bg-black/10'
    }
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <h2 className="text-lg font-semibold text-ink">Payment Calendar {year}</h2>
      
      <div className="overflow-x-auto bg-paper-raised border border-brass/20 rounded-xl shadow-sm p-4">
        <table className="w-full text-sm text-left border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="p-2 font-medium text-ink-soft border-b border-brass/20">House</th>
              {MONTHS.map(m => (
                <th key={m} className="p-2 font-medium text-ink-soft border-b border-brass/20 text-center">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {houses.map(h => (
              <tr key={h.id} className="border-b border-brass/10 last:border-0">
                <td className="p-2 font-medium text-ink whitespace-nowrap">House {h.internalDoorNumber}</td>
                {MONTHS.map((m, idx) => {
                  const monthStr = `${year}-${String(idx + 1).padStart(2, '0')}`
                  const cell = gridData[h.id]?.[monthStr]
                  return (
                    <td key={monthStr} className="p-1">
                      <div 
                        onClick={() => setSelectedCell({ house: h, monthStr, cell })}
                        className={`w-6 h-6 mx-auto rounded-full cursor-pointer ${getStatusColor(cell?.status)} transition-transform hover:scale-110 shadow-sm`}
                        title={cell?.status}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-ink-soft bg-paper-raised p-3 rounded-lg border border-brass/20">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-stamp-green shadow-sm" /> Paid</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-stamp-amber shadow-sm" /> Pending</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-stamp-red shadow-sm" /> Not Paid</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-black/10 shadow-sm" /> Vacant</div>
      </div>

      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCell(null)}>
          <div className="bg-paper-raised rounded-xl p-5 shadow-lg max-w-sm w-full border border-brass/20" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-2">
              House {selectedCell.house.internalDoorNumber} - {selectedCell.monthStr}
            </h3>
            {selectedCell.cell.rents.length > 0 ? (
              <div className="space-y-2">
                {selectedCell.cell.rents.map(r => (
                  <div key={r.id} className="text-sm p-3 bg-paper rounded-lg border border-brass/20">
                    <p className="font-medium text-ink">₹{r.amount}</p>
                    <p className="text-ink-soft">Mode: {r.mode}</p>
                    <p className="text-ink-soft">Status: {r.status}</p>
                    <p className="text-ink-soft font-mono text-xs mt-1">{r.applicationNumber}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft py-4 text-center">No payments recorded for this month.</p>
            )}
            <button 
              onClick={() => setSelectedCell(null)}
              className="mt-4 w-full bg-cover text-white py-2 rounded-lg text-sm font-medium hover:bg-cover/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
