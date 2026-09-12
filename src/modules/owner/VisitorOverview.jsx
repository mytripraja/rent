import { useState, useEffect } from 'react'
import { listTodaysVisitors, updateVisitorStatus } from '../../services/visitorService'
import { CheckCircle } from 'lucide-react'

export default function VisitorOverview() {
  const [visitors, setVisitors] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await listTodaysVisitors()
    setVisitors(data)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-6">Today's Visitors</h2>
      
      <div className="space-y-4">
        {visitors.length === 0 && (
          <p className="text-ink-soft">No expected visitors today.</p>
        )}
        
        {visitors.map(v => (
          <div key={v.id} className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/10 flex justify-between items-center">
            <div>
              <p className="font-medium text-lg">{v.visitorName}</p>
              <p className="text-sm text-ink-soft">House: <span className="font-bold text-ink">{v.houseId}</span></p>
              <p className="text-sm text-ink-soft">{v.expectedTime} • {v.purpose}</p>
              {v.vehicleNumber && <p className="text-xs font-mono mt-1 px-2 py-0.5 bg-ink/10 rounded inline-block">{v.vehicleNumber}</p>}
            </div>
            
            {v.status === 'expected' ? (
              <button 
                onClick={() => {
                  updateVisitorStatus(v.id, 'arrived').then(load)
                }}
                className="p-2 bg-stamp-green/10 text-stamp-green rounded-full"
              >
                <CheckCircle size={24} />
              </button>
            ) : (
              <span className="text-xs bg-stamp-green text-paper px-2 py-1 rounded-full">Arrived</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
