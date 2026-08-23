import { useEffect, useState } from 'react'
import { listHouses } from '../../services/houseService'
import { listAllComplaints, submitOwnerComplaint, resolveComplaint } from '../../services/complaintService'

export default function ComplaintInbox() {
  const [houses, setHouses] = useState([])
  const [complaints, setComplaints] = useState([])
  const [showSend, setShowSend] = useState(false)
  const [filter, setFilter] = useState('open') // open | resolved | all

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setHouses(await listHouses())
    setComplaints(await listAllComplaints())
  }

  async function handleResolve(id) {
    await resolveComplaint(id)
    refresh()
  }

  const filtered = complaints.filter((c) => filter === 'all' || c.status === filter)

  function houseLabel(houseId) {
    return houses.find((h) => h.id === houseId)?.internalDoorNumber || houseId
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Complaints</h2>
          <p className="text-sm text-ink-soft">Only visible to you.</p>
        </div>
        <button
          onClick={() => setShowSend(true)}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark self-start sm:self-auto"
        >
          + Send Complaint to House(s)
        </button>
      </div>

      <div className="flex gap-2">
        {['open', 'resolved', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize ${
              filter === f ? 'bg-brand text-white' : 'bg-paper-raised text-ink-soft border border-brass/25'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((c) => (
          <div key={c.id} className="bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-ink-soft mb-1">
                  {c.direction === 'tenant_to_owner'
                    ? `From House ${houseLabel(c.fromHouseId)}`
                    : `To: ${c.targetHouseIds === 'all' ? 'All houses' : c.targetHouseIds.map(houseLabel).join(', ')}`}
                </p>
                <p className="text-sm text-ink">{c.message}</p>
                <p className="text-xs text-ink-soft mt-1">{new Date(c.createdAt).toLocaleString()}</p>
              </div>
              {c.status === 'open' ? (
                <button onClick={() => handleResolve(c.id)} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium shrink-0">
                  Mark Resolved
                </button>
              ) : (
                <span className="text-xs bg-paper text-ink-soft px-3 py-1.5 rounded-lg shrink-0">Resolved</span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-ink-soft py-6 text-center">No complaints here.</p>}
      </div>

      {showSend && (
        <SendComplaintModal houses={houses} onClose={() => setShowSend(false)} onSent={refresh} />
      )}
    </div>
  )
}

function SendComplaintModal({ houses, onClose, onSent }) {
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('all')
  const [selectedHouseIds, setSelectedHouseIds] = useState([])
  const [sending, setSending] = useState(false)

  function toggleHouse(houseId) {
    setSelectedHouseIds((ids) =>
      ids.includes(houseId) ? ids.filter((id) => id !== houseId) : [...ids, houseId]
    )
  }

  async function submit(e) {
    e.preventDefault()
    setSending(true)
    try {
      await submitOwnerComplaint({
        targetHouseIds: audience === 'all' ? 'all' : selectedHouseIds,
        message,
      })
      onSent()
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-ink">Send Complaint</h3>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink-soft">✕</button>
        </div>

        <textarea required rows={3} placeholder="Message" value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={audience === 'all'} onChange={() => setAudience('all')} />
            All houses
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={audience === 'select'} onChange={() => setAudience('select')} />
            Select houses
          </label>
        </div>

        {audience === 'select' && (
          <div className="flex flex-wrap gap-2">
            {houses.map((h) => (
              <button
                type="button"
                key={h.id}
                onClick={() => toggleHouse(h.id)}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  selectedHouseIds.includes(h.id)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-paper-raised text-ink-soft border-brass/30'
                }`}
              >
                {h.internalDoorNumber}
              </button>
            ))}
          </div>
        )}

        <button disabled={sending} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
