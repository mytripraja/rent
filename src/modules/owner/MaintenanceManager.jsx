import { useState, useEffect } from 'react'
import { listAllRequests, updateRequestStatus, resolveRequest } from '../../services/maintenanceService'
import { motion } from 'framer-motion'
import { Wrench, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react'

export default function MaintenanceManager() {
  const [requests, setRequests] = useState([])
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await listAllRequests()
    setRequests(data)
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <h1 className="text-2xl font-display text-cover mb-4">Maintenance Requests</h1>
      
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['all', 'open', 'in_progress', 'resolved'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === f ? 'bg-cover text-paper' : 'bg-paper-raised border border-ink-soft/30 text-ink-soft'
            }`}
          >
            {f.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(req => (
          <motion.div layout key={req.id} className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/5">
            <div 
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setExpanded(expanded === req.id ? null : req.id)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cover/10 rounded-full text-cover">
                  <Wrench size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-ink">{req.category.toUpperCase()} - {req.houseId}</h3>
                  <p className="text-sm text-ink-soft">{req.tenantName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-mono ${
                  req.priority === 'urgent' ? 'bg-stamp-red/20 text-stamp-red' :
                  req.priority === 'high' ? 'bg-stamp-amber/20 text-stamp-amber' :
                  'bg-ink/10 text-ink'
                }`}>
                  {req.priority}
                </span>
                {expanded === req.id ? <ChevronUp size={20} className="text-ink-soft" /> : <ChevronDown size={20} className="text-ink-soft" />}
              </div>
            </div>

            {expanded === req.id && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 pt-4 border-t border-ink/10">
                <p className="text-ink text-sm mb-4">{req.description}</p>
                
                {req.photos && req.photos.length > 0 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto">
                    {req.photos.map((p, i) => (
                      <img key={i} src={p.url} alt="Maintenance" className="h-20 w-20 object-cover rounded-md border border-ink/10" />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  {req.status === 'open' && (
                    <button 
                      onClick={() => {
                        updateRequestStatus(req.id, { status: 'in_progress' }).then(load)
                      }}
                      className="flex-1 bg-brass text-paper py-2 rounded-md flex items-center justify-center gap-2"
                    >
                      <Clock size={16} /> Mark In Progress
                    </button>
                  )}
                  {req.status !== 'resolved' && (
                    <button 
                      onClick={() => {
                        resolveRequest(req.id).then(load)
                      }}
                      className="flex-1 bg-stamp-green text-paper py-2 rounded-md flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} /> Resolve
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
        
        {filtered.length === 0 && (
          <p className="text-center text-ink-soft py-8">No requests found.</p>
        )}
      </div>
    </div>
  )
}
