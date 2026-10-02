import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listPendingApprovals, approvePayment, rejectPayment, calculateLateFee } from '../../services/rentService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'
import RentReceipt from '../shared/RentReceipt'
import { getPaymentProofUrl } from '../../services/cloudinaryService'

export default function RentApprovalQueue() {
  const { user } = useAuth()
  const [proofUrls, setProofUrls] = useState({})
  const [pending, setPending] = useState([])
  const [loadingApprovals, setLoadingApprovals] = useState(true)
  const [approvalError, setApprovalError] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const [houseMap, setHouseMap] = useState({})
  const [collectingId, setCollectingId] = useState(null)
  const [collectorName, setCollectorName] = useState('')
  const [receivers, setReceivers] = useState([])
  const [receiptPayment, setReceiptPayment] = useState(null)
  const toast = useToast()

  const [appConfig, setAppConfig] = useState(null)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoadingApprovals(true)
    setApprovalError('')
    try {
      const { getAppConfig } = await import('../../services/configService')
      // The approval API now returns the minimal house context with each waiting
      // payment, so the page no longer waits for a separate full house query.
      const approvalsPromise = listPendingApprovals()
      const configPromise = getAppConfig()
      const approvals = await approvalsPromise
      const hMap = {}
      approvals.forEach(p => { if (p._house) hMap[p.houseId] = p._house })
      setHouseMap(hMap)
      setPending(approvals)
      // Show approvals as soon as they arrive; config is only needed for late-fee
      // calculation and must never block the approval list.
      configPromise.then(config => { setReceivers(config.cashReceivers || []); setAppConfig(config) }).catch(() => {})
    } catch (error) {
      console.error('Error fetching approvals', error)
      toast.error('Failed to fetch pending approvals')
      setApprovalError(error.message || 'Could not load rent approvals.')
    } finally {
      setLoadingApprovals(false)
    }
  }

  async function handleApprove(payment) {
    if (payment.mode === 'neighbor') {
      setCollectingId(payment)
      setCollectorName('')
      return
    }
    
    try {
      await approvePayment(payment.id, { actionedBy: { uid: user.uid, name: user.name } })
      toast.success('Payment approved')
      setReceiptPayment({ ...payment, actionedBy: { uid: user.uid, name: user.name }, status: 'approved' })
      refresh()
    } catch (error) {
      console.error("Error approving payment", error)
      toast.error('Failed to approve payment')
    }
  }

  async function confirmNeighborCollection() {
    if (!collectorName) return toast.error('Please select a collector')
    
    try {
      await approvePayment(collectingId.id, { 
        neighborCollectedBy: collectorName, 
        actionedBy: { uid: user.uid, name: user.name } 
      })
      toast.success('Payment approved')
      setReceiptPayment({ ...collectingId, neighborCollectedBy: collectorName, actionedBy: { uid: user.uid, name: user.name }, status: 'approved' })
      setCollectingId(null)
      refresh()
    } catch (error) {
      console.error("Error approving payment", error)
      toast.error('Failed to approve payment')
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      toast.error('Please enter a reason')
      return
    }
    try {
      await rejectPayment(rejectingId, reason, { uid: user.uid, name: user.name })
      toast.success('Payment rejected')
      setRejectingId(null)
      setReason('')
      refresh()
    } catch (error) {
      console.error("Error rejecting payment", error)
      toast.error('Failed to reject payment')
    }
  }

  if (loadingApprovals) return <p role="status" className="text-sm text-ink-soft py-8 text-center">Loading pending rent approvals…</p>
  if (approvalError) return <div role="alert" className="p-4 text-red-700">{approvalError} <button className="underline ml-2" onClick={refresh}>Retry</button></div>
  if (pending.length === 0) {
    return <p className="text-sm text-ink-soft py-8 text-center">No rent submissions waiting for approval.</p>
  }

  async function openProof(payment) {
    if (proofUrls[payment.id] || payment.proofUrl) return
    try { const url = await getPaymentProofUrl('rentPayments', payment.id); setProofUrls(v => ({ ...v, [payment.id]: url })); window.open(url, '_blank', 'noopener,noreferrer') } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">Pending Approvals</h2>
      <AnimatePresence>
        {pending.map((p) => {
          const house = houseMap[p.houseId]
          const lateFee = (appConfig && house && p.dateSent) 
            ? calculateLateFee(house.rentAmount, `${p.month}-05`, p.dateSent, appConfig) 
            : 0

          return (
            <div key={p.id} className="relative mb-3 overflow-hidden rounded-xl bg-paper-raised border border-brass/20 shadow-sm">
              <div className="absolute inset-0 flex justify-between items-center px-6" aria-hidden="true">
                <div className="text-red-600 font-medium flex items-center gap-2">✕ Reject</div>
                <div className="text-stamp-green font-medium flex items-center gap-2">Approve ✓</div>
              </div>
              <motion.div
                layout
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={(e, info) => {
                  if (info.offset.x > 100) {
                    handleApprove(p)
                  } else if (info.offset.x < -100) {
                    setRejectingId(p.id)
                  }
                }}
                className="bg-paper-raised relative z-10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {house?.tenantName || 'Tenant'} · House {house?.internalDoorNumber || p.houseId} · {p.month} · ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                    {p.entrySource === 'dad_lite' ? <span className="ml-2 text-xs font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">Dad Lite</span> : p.uploadedByOwner ? <span className="ml-2 text-xs text-blue-600">(Uploaded by Owner)</span> : null}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Mode: {p.mode}{p.mode === 'cash' && ` · Received by ${p.cashReceivedBy}`}{p.mode === 'neighbor' && ` · Via neighbor house ${houseMap[p.neighborHouseId]?.internalDoorNumber || p.neighborHouseId}`}
                  </p>
                  <p className="text-xs text-ink-soft">Sent: {p.dateSent} · App# {p.applicationNumber}</p>
                  {p.recordedBy && <p className="text-xs text-ink-soft">Entered by {p.recordedBy.name}</p>}
                  {lateFee > 0 && <p className="text-xs text-stamp-red font-medium mt-1">Late fee: ₹{lateFee}</p>}
                  {p.proofUrl && (
                    <a href={proofUrls[p.id] || p.proofUrl || '#'} target="_blank" rel="noreferrer" onClick={e => { if (!p.proofUrl && !proofUrls[p.id]) { e.preventDefault(); openProof(p) } }} className="text-xs text-brand hover:underline mt-1 inline-block">
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
              <div className="text-center text-xs text-ink-soft py-1 absolute bottom-0 w-full z-20 pointer-events-none opacity-60 bg-paper-raised/80">
                ← Reject | Approve →
              </div>
            </div>
          )
        })}
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

      {receiptPayment && (
        <RentReceipt 
          payment={receiptPayment} 
          house={houseMap[receiptPayment.houseId]} 
          onClose={() => setReceiptPayment(null)} 
        />
      )}
    </div>
  )
}
