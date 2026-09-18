import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listPendingWaterApprovals, approveWaterPayment, rejectWaterPayment } from '../../services/waterBillService'
import { listHouses } from '../../services/houseService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'

export default function WaterApprovalQueue() {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const [houseMap, setHouseMap] = useState({})
  const [collectingId, setCollectingId] = useState(null)
  const [collectorName, setCollectorName] = useState('')
  const [receivers, setReceivers] = useState([])
  const toast = useToast()

  useEffect(() => {
    refresh()
    loadData()
  }, [])

  async function loadData() {
    try {
      const [hList, rec] = await Promise.all([
        listHouses(),
        getCashReceivers()
      ])
      const hMap = {}
      hList.forEach(h => hMap[h.id] = h)
      setHouseMap(hMap)
      setReceivers(rec)
    } catch (error) {
      console.error("Error loading data", error)
      toast.error('Failed to load initial data')
    }
  }

  async function refresh() {
    try {
      setPending(await listPendingWaterApprovals())
    } catch (error) {
      console.error("Error fetching approvals", error)
      toast.error('Failed to fetch pending Water approvals')
    }
  }

  async function handleApprove(payment) {
    if (payment.mode === 'neighbor') {
      setCollectingId(payment)
      setCollectorName('')
      return
    }
    
    try {
      await approveWaterPayment(payment.id, { actionedBy: { uid: user.uid, name: user.name } })
      toast.success('Water Payment approved')
      refresh()
    } catch (error) {
      console.error("Error approving Water payment", error)
      toast.error('Failed to approve Water payment')
    }
  }

  async function confirmNeighborCollection() {
    if (!collectorName) return toast.error('Please select a collector')
    
    try {
      await approveWaterPayment(collectingId.id, { 
        neighborCollectedBy: collectorName, 
        actionedBy: { uid: user.uid, name: user.name } 
      })
      toast.success('Water Payment approved')
      refresh()
    } catch (error) {
      console.error("Error approving Water payment", error)
      toast.error('Failed to approve Water payment')
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      toast.error('Please enter a reason')
      return
    }
    try {
      await rejectWaterPayment(rejectingId, reason, { uid: user.uid, name: user.name })
      toast.success('Water Payment rejected')
      setRejectingId(null)
      setReason('')
      refresh()
    } catch (error) {
      console.error("Error rejecting Water payment", error)
      toast.error('Failed to reject Water payment')
    }
  }

  if (pending.length === 0) {
    return <p className="text-sm text-ink-soft py-8 text-center">No Water bill submissions waiting for approval.</p>
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">Water Bill — Pending Approvals</h2>
      <AnimatePresence>
        {pending.map((p) => (
          <motion.div
            layout
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            key={p.id}
            className="bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                House {houseMap[p.houseId]?.internalDoorNumber || p.houseId} · ₹{p.amount}
                {p.uploadedByOwner && <span className="ml-2 text-xs text-blue-600">(Uploaded by Owner)</span>}
              </p>
              <p className="text-xs text-ink-soft">
                Mode: {p.mode}{p.mode === 'cash' && ` · Received by ${p.cashReceivedBy}`}{p.mode === 'neighbor' && ` · Via neighbor house ${houseMap[p.neighborHouseId]?.internalDoorNumber || p.neighborHouseId}`}
              </p>
              <p className="text-xs text-ink-soft">Sent: {p.dateSent} · App# {p.applicationNumber}</p>
              {p.recordedBy && <p className="text-xs text-ink-soft">Entered by {p.recordedBy.name}</p>}
              {p.proofUrl && (
                <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                  View proof screenshot
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleApprove(p)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium">
                Approve
              </button>
              <button onClick={() => setRejectingId(p.id)} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium">
                Reject
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-3">
            <h3 className="font-semibold text-ink">Reason for rejection</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" rows={3} />
            <div className="flex gap-2">
              <button onClick={handleReject} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Reject</button>
              <button onClick={() => setRejectingId(null)} className="flex-1 bg-paper border border-brass/30 text-ink-soft py-2 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!collectingId}
        onClose={() => setCollectingId(null)}
        onConfirm={confirmNeighborCollection}
        title="Neighbor Collection"
        message="Who actually collected this from the neighbor?"
        confirmText="Approve"
      >
        <select
          value={collectorName}
          onChange={(e) => setCollectorName(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm mt-3"
        >
          <option value="">Select collector...</option>
          {receivers.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </ConfirmDialog>
    </div>
  )
}
