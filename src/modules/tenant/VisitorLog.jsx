import { useState, useEffect } from 'react'
import { registerVisitor, listVisitorsForHouse } from '../../services/visitorService'
import { useAuth } from '../../context/AuthContext'

export default function VisitorLog() {
  const { user } = useAuth()
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.houseId) load()
  }, [user])

  async function load() {
    const data = await listVisitorsForHouse(user.houseId)
    setVisitors(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.target)
    
    await registerVisitor({
      houseId: user.houseId,
      tenantId: user.uid,
      visitorName: fd.get('name'),
      purpose: fd.get('purpose'),
      expectedDate: fd.get('date'),
      expectedTime: fd.get('time'),
      vehicleNumber: fd.get('vehicle'),
      notes: fd.get('notes')
    })
    
    e.target.reset()
    setLoading(false)
    load()
  }

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <h1 className="text-2xl font-display text-cover mb-6">Visitor Log</h1>
      
      <form onSubmit={handleSubmit} className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/10 mb-8 space-y-4">
        <h2 className="font-medium text-lg">Pre-register Visitor</h2>
        
        <input name="name" placeholder="Visitor Name" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
        <select name="purpose" required className="w-full p-2 border border-ink/20 rounded bg-paper">
          <option value="personal">Personal</option>
          <option value="delivery">Delivery</option>
          <option value="service">Service</option>
        </select>
        <div className="flex gap-2">
          <input name="date" type="date" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
          <input name="time" type="time" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
        </div>
        <input name="vehicle" placeholder="Vehicle No (Optional)" className="w-full p-2 border border-ink/20 rounded bg-paper" />
        <button type="submit" disabled={loading} className="w-full py-3 bg-cover text-paper rounded-md">
          {loading ? 'Registering...' : 'Register Visitor'}
        </button>
      </form>

      <div className="space-y-4">
        <h2 className="font-medium text-lg">Past & Expected Visitors</h2>
        {visitors.map(v => (
          <div key={v.id} className="bg-paper-raised p-3 rounded border border-ink/5 flex justify-between items-center">
            <div>
              <p className="font-medium">{v.visitorName}</p>
              <p className="text-xs text-ink-soft">{v.expectedDate} at {v.expectedTime} • {v.purpose}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${v.status === 'expected' ? 'bg-stamp-amber/20 text-stamp-amber' : 'bg-stamp-green/20 text-stamp-green'}`}>
              {v.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
