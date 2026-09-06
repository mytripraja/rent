import { useState, useEffect } from 'react'
import { submitRequest, listRequestsForHouse } from '../../services/maintenanceService'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'
import { Plus, X, Camera } from 'lucide-react'

export default function MaintenanceRequest() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.houseId) load()
  }, [user])

  async function load() {
    const data = await listRequestsForHouse(user.houseId)
    setRequests(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.target)
    
    await submitRequest({
      houseId: user.houseId,
      tenantId: user.uid,
      tenantName: user.name || 'Tenant',
      category: fd.get('category'),
      description: fd.get('description'),
      priority: fd.get('priority'),
      photoFiles: [] // simplify for mvp, file inputs can be added via e.target.photos.files
    })
    
    setLoading(false)
    setShowForm(false)
    load()
  }

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-display text-cover">Maintenance</h1>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="p-2 bg-cover text-paper rounded-full"
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {showForm && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          onSubmit={handleSubmit}
          className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/10 mb-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select name="category" required className="w-full p-2 border border-ink/20 rounded bg-paper">
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="carpentry">Carpentry</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select name="priority" required className="w-full p-2 border border-ink/20 rounded bg-paper">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea name="description" required rows="3" className="w-full p-2 border border-ink/20 rounded bg-paper"></textarea>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-cover text-paper rounded-md font-medium"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </motion.form>
      )}

      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/5">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-ink capitalize">{req.category}</h3>
              <span className={`text-xs px-2 py-1 rounded-full font-mono ${
                req.status === 'resolved' ? 'bg-stamp-green/20 text-stamp-green' : 
                'bg-stamp-amber/20 text-stamp-amber'
              }`}>
                {req.status}
              </span>
            </div>
            <p className="text-sm text-ink-soft line-clamp-2">{req.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
