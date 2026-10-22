import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { listPendingApprovals, approvePayment, rejectPayment, calculateLateFee } from '../../services/rentService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'
import RentReceipt from '../shared/RentReceipt'
import SwipeableApprovalCard from '../shared/ui/SwipeableApprovalCard'
import { getPaymentProofUrl } from '../../services/cloudinaryService'
import { triggerHaptic } from '../../utils/haptics'
import { listHouses } from '../../services/houseService'
import { listRentHistory } from '../../services/rentService'

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
  const { showToast } = useToast()

  const [appConfig, setAppConfig] = useState(null)
  const [view, setView] = useState('pending')
  const [historyRows, setHistoryRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7))
  const [submissionQuery, setSubmissionQuery] = useState('')
  const [confirmingPayment, setConfirmingPayment] = useState(null)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoadingApprovals(true)
    setApprovalError('')
    try {
      const { getAppConfig } = await import('../../services/configService')
      // The approval API now returns the minimal house context with each waiting
      // payment, so the page no longer waits for a separate full house query.
      const [approvals, houseList] = await Promise.all([listPendingApprovals(), listHouses()])
      setHistoryLoading(true)
      const historyResults = await Promise.all(houseList.map(async h => {
        try { return (await listRentHistory(h.id)).map(p => ({ ...p, _house: h })) }
        catch (e) { console.warn('Could not load rent history for house', h.id, e); return [] }
      }))
      setHistoryRows(historyResults.flat().sort((a,b) => Number(b.submittedAt || b.approvedAt || 0) - Number(a.submittedAt || a.approvedAt || 0)))
      setHistoryLoading(false)
      const configPromise = getAppConfig()
      const hMap = {}
      approvals.forEach(p => { if (p._house) hMap[p.houseId] = p._house })
      setHouseMap(hMap)
      setPending(approvals)
      // Show approvals as soon as they arrive; config is only needed for late-fee
      // calculation and must never block the approval list.
      configPromise.then(config => { setReceivers(config.cashReceivers || []); setAppConfig(config) }).catch(() => {})
    } catch (error) {
      console.error('Error fetching approvals', error)
      showToast({ message: 'Failed to fetch pending approvals', type: 'error' })
      setApprovalError(error.message || 'Could not load rent approvals.')
      setHistoryLoading(false)
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
      showToast({ message: 'Payment approved', type: 'success' })
      setReceiptPayment({ ...payment, actionedBy: { uid: user.uid, name: user.name }, status: 'approved' })
      refresh()
    } catch (error) {
      console.error("Error approving payment", error)
      showToast({ message: 'Failed to approve payment', type: 'error' })
    }
  }

  async function confirmNeighborCollection() {
    if (!collectorName) return showToast({ message: 'Please select a collector', type: 'error' })
    
    try {
      await approvePayment(collectingId.id, { 
        neighborCollectedBy: collectorName, 
        actionedBy: { uid: user.uid, name: user.name } 
      })
      showToast({ message: 'Payment approved', type: 'success' })
      setReceiptPayment({ ...collectingId, neighborCollectedBy: collectorName, actionedBy: { uid: user.uid, name: user.name }, status: 'approved' })
      setCollectingId(null)
      refresh()
    } catch (error) {
      console.error("Error approving payment", error)
      showToast({ message: 'Failed to approve payment', type: 'error' })
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      showToast({ message: 'Please enter a reason', type: 'error' })
      return
    }
    try {
      await rejectPayment(rejectingId, reason, { uid: user.uid, name: user.name })
      showToast({ message: 'Payment rejected', type: 'success' })
      setRejectingId(null)
      setReason('')
      refresh()
    } catch (error) {
      console.error("Error rejecting payment", error)
      showToast({ message: 'Failed to reject payment', type: 'error' })
    }
  }

  if (loadingApprovals) return <p role="status" className="text-sm text-ink-soft py-8 text-center">Loading pending rent approvals…</p>
  if (approvalError) return <div role="alert" className="p-4 text-red-700">{approvalError} <button className="underline ml-2" onClick={refresh}>Retry</button></div>
  async function openProof(payment) {
    if (proofUrls[payment.id] || payment.proofUrl) return
    try { const url = await getPaymentProofUrl('rentPayments', payment.id); setProofUrls(v => ({ ...v, [payment.id]: url })); window.open(url, '_blank', 'noopener,noreferrer') } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-ink">Rent approvals & history</h2><p className="text-xs text-ink-soft mt-1">Review the payment details before approving or rejecting a submission.</p></div><div className="flex rounded-xl border border-[var(--rm-border)] p-1 bg-paper-raised"><button onClick={() => setView('pending')} className={`px-3 py-2 rounded-lg text-sm ${view === 'pending' ? 'bg-brand text-white' : 'text-ink-soft'}`}>Pending ({pending.length})</button><button onClick={() => setView('history')} className={`px-3 py-2 rounded-lg text-sm ${view === 'history' ? 'bg-brand text-white' : 'text-ink-soft'}`}>Approval history</button></div></div>
      {view === 'history' ? (
        <section className="rounded-2xl border border-[var(--rm-border)] bg-paper-raised p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-ink">Monthly rent history</h3><p className="text-xs text-ink-soft">Approved, waiting and rejected entries grouped month by month.</p></div><input aria-label="Filter history by month" type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)} className="border border-[var(--rm-border)] rounded-lg px-3 py-2 text-sm" /></div>{historyLoading ? <p className="text-sm text-ink-soft py-4">Loading history…</p> : historyRows.filter(p => p.month === historyMonth).length === 0 ? <p className="text-sm text-ink-soft py-5 text-center">No rent entries for {historyMonth}.</p> : <div className="space-y-2">{historyRows.filter(p => p.month === historyMonth).map(p => <div key={p.id} className="rounded-xl border border-[var(--rm-border)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="font-medium text-ink">{p._house?.internalDoorNumber || p.houseId} · {p._house?.tenantName || 'Tenant'} · ₹{Number(p.amount || 0).toLocaleString('en-IN')}</p><p className="text-xs text-ink-soft">{p.month} · {p.dateSent || 'No payment date'} · Ref {p.applicationNumber || p.id}</p>{p.rejectionReason && <p className="text-xs text-red-600">Reason: {p.rejectionReason}</p>}</div><span className={`text-xs font-semibold rounded-full px-3 py-1 self-start ${p.status === 'approved' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{p.status === 'approved' ? 'Approved' : p.status === 'rejected' ? 'Rejected' : 'Waiting'}</span></div>)}</div>}</section>
      ) : (
        <><div className="relative"><input type="search" value={submissionQuery} onChange={e => setSubmissionQuery(e.target.value)} placeholder="Search unit, tenant, month or reference" aria-label="Search rent submissions" className="w-full rounded-lg border border-[var(--rm-border)] bg-paper-raised px-3 py-2.5 text-sm" /></div><h3 className="text-sm text-ink-soft">Pending approvals · {pending.length}</h3>{pending.length === 0 ? <p className="text-sm text-ink-soft py-8 text-center rounded-2xl border border-[var(--rm-border)] bg-paper-raised">No rent submissions waiting for approval.</p> : <AnimatePresence>
        {pending.filter(p => {
          const house = houseMap[p.houseId]
          const query = submissionQuery.trim().toLowerCase()
          return !query || [house?.tenantName, house?.internalDoorNumber, p.month, p.applicationNumber, p.amount, p.mode].some(value => String(value || '').toLowerCase().includes(query))
        }).map((p) => {
          const house = houseMap[p.houseId]
          const lateFee = (appConfig && house && p.dateSent) 
            ? calculateLateFee(house.rentAmount, `${p.month}-05`, p.dateSent, appConfig) 
            : 0

          return (
            <SwipeableApprovalCard
              key={p.id}
              className="mb-3"
              hint="← Reject | Approve →"
              onApprove={() => setConfirmingPayment(p)}
              onReject={() => setRejectingId(p.id)}
            >
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
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
                  <button onClick={() => { setConfirmingPayment(p) }} className="text-xs bg-green-600 text-white px-3 py-1.5 min-h-11 rounded-lg font-medium">
                    Approve
                  </button>
                  <button onClick={() => { triggerHaptic('error'); setRejectingId(p.id) }} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 min-h-11 rounded-lg font-medium">
                    Reject
                  </button>
                </div>
              </div>
            </SwipeableApprovalCard>
          )
        })}
        {pending.length > 0 && !pending.some(p => {
          const house = houseMap[p.houseId]; const query = submissionQuery.trim().toLowerCase()
          return !query || [house?.tenantName, house?.internalDoorNumber, p.month, p.applicationNumber, p.amount, p.mode].some(value => String(value || '').toLowerCase().includes(query))
        }) && <p className="rounded-xl border border-[var(--rm-border)] bg-paper-raised p-5 text-center text-sm text-ink-soft">No pending submissions match “{submissionQuery}”.</p>}
      </AnimatePresence>}</>
      )}

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

      <ConfirmDialog
        open={!!confirmingPayment}
        onClose={() => setConfirmingPayment(null)}
        onConfirm={() => { if (confirmingPayment) { triggerHaptic('success'); handleApprove(confirmingPayment) } }}
        title="Confirm rent approval"
        message={confirmingPayment ? `Approve ₹${Number(confirmingPayment.amount || 0).toLocaleString('en-IN')} for ${houseMap[confirmingPayment.houseId]?.tenantName || 'this tenant'} · House ${houseMap[confirmingPayment.houseId]?.internalDoorNumber || confirmingPayment.houseId} · ${confirmingPayment.month}?` : ''}
        confirmText="Confirm approval"
      >
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Verify the payment against the actual receipt or bank record. A screenshot alone does not confirm that funds reached the owner.</p>
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
