import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  runTransaction,
} from 'firebase/firestore'
import { db, authedFetch } from './firebase'
import { getActivePropertyId } from './configService'
import { uploadPrivate } from './cloudinaryService'
import { createNotification } from './notificationService'
import { cachedRequest, invalidateCache } from './performanceCache'

const paymentsRef = collection(db, 'rentPayments')

function generateApplicationNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `RENT-${Date.now().toString().slice(-6)}-${rand}`
}

// mode: 'upi' | 'bank' | 'cash' | 'neighbor'
// recordedBy: { uid, name } of whoever is filling this in — the tenant themself,
// or the owner/co-owner if this is a manual entry (uploadedByOwner: true).
export async function submitRentPayment({
  houseId,
  tenantId,
  month, // e.g. '2026-08'
  amount,
  dateSent,
  mode,
  cashReceivedBy, // deepu | rajavel | siva | hemalathe | others
  neighborHouseId, // if mode === 'neighbor'
  proofFile,
  uploadedByOwner = false,
  recordedBy,
}) {
  let proofUrl = null
  let proofPublicId = null
  let proofResourceType = null
  if (proofFile) {
    const uploaded = await uploadPrivate(proofFile, `rent-proofs/${houseId}`)
    proofUrl = null
    proofPublicId = uploaded.publicId
    proofResourceType = uploaded.resourceType
  }

  const applicationNumber = generateApplicationNumber()

  await addDoc(paymentsRef, {
    houseId,
    tenantId,
    month,
    amount,
    dateSent,
    mode,
    cashReceivedBy: mode === 'cash' ? cashReceivedBy : null,
    neighborHouseId: mode === 'neighbor' ? neighborHouseId : null,
    neighborCollectedBy: null, // owner fills this in on approval if mode === neighbor
    proofUrl,
    proofPublicId: proofPublicId || null,
    proofResourceType: proofResourceType || null,
    applicationNumber,
    status: 'waiting_approval', // waiting_approval | approved | rejected
    uploadedByOwner,
    recordedBy: recordedBy || null,
    rejectionReason: null,
    submittedAt: Date.now(),
    approvedAt: null,
    actionedBy: null,
  })

  return applicationNumber
}

export async function listRentPaymentsForMonth(month) {
  const snap = await getDocs(query(paymentsRef, where('month', '==', month)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Property-scoped bulk read. Firestore 'in' supports up to 30 values, so chunk
// house IDs instead of downloading every rent payment across every apartment.
export async function listRentPaymentsForHouses(houseIds = []) {
  const ids = [...new Set((houseIds || []).filter(Boolean))]
  const chunks = []
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(query(paymentsRef, where('houseId', 'in', chunk))))
  )
  const seen = new Map()
  snapshots.forEach((snap) => snap.docs.forEach((d) => seen.set(d.id, { id: d.id, ...d.data() })))
  return [...seen.values()]
}

export async function listPendingApprovals(houseIds = []) {
  const ids = [...new Set((houseIds || []).filter(Boolean))]
  const cacheKey = `rent-approvals:${getActivePropertyId() || 'default'}:${ids.slice().sort().join(',')}`
  return cachedRequest(cacheKey, async () => {
    try {
      const result = await authedFetch('/api/rental?route=pending-rent-approvals', {
        propertyId: getActivePropertyId() || 'default',
        houseIds: ids,
      })
      return (result.payments || []).sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))
    } catch (serverError) {
      console.warn('Secure rent approval API unavailable; using Firestore fallback:', serverError?.message || serverError)
      const chunks = []
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
      if (!chunks.length) return []
      const snapshots = await Promise.all(chunks.map((chunk) => getDocs(query(paymentsRef, where('houseId', 'in', chunk)))))
      const seen = new Map()
      snapshots.forEach((snap) => snap.docs.forEach((d) => {
        const data = d.data()
        if (data.status === 'waiting_approval') seen.set(d.id, { id: d.id, ...data })
      }))
      return [...seen.values()].sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))
    }
  }, 8000)
}

export function invalidateRentApprovalCache() {
  invalidateCache('rent-approvals:')
}

export async function getTenantRentStatus(month) {
  return authedFetch('/api/tenant-rent-status', { month })
}

export async function listRentHistory(houseId) {
  const snap = await getDocs(query(paymentsRef, where('houseId', '==', houseId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))
}

export async function approvePayment(paymentId, { neighborCollectedBy, actionedBy } = {}) {
  const paymentRef = doc(db, 'rentPayments', paymentId)
  const journalDebitRef = doc(db, 'accountingTransactions', `rent-${paymentId}-debit`)
  const journalCreditRef = doc(db, 'accountingTransactions', `rent-${paymentId}-credit`)

  // Commit approval and both journal lines together. A retry cannot create a
  // second rent journal, and a failed journal write cannot leave an approved payment.
  const result = await runTransaction(db, async (tx) => {
    const paymentSnap = await tx.get(paymentRef)
    if (!paymentSnap.exists()) throw new Error('Rent payment not found')
    const paymentData = paymentSnap.data()
    if (paymentData.status !== 'waiting_approval') throw new Error('This payment is no longer pending approval. Refresh the queue and review its status.')
    const currentHouseRef = paymentData.houseId ? doc(db, 'houses', paymentData.houseId) : null
    const currentHouseSnap = currentHouseRef ? await tx.get(currentHouseRef) : null
    const currentHouse = currentHouseSnap?.exists() ? currentHouseSnap.data() : null
    if (!currentHouse) throw new Error('The payment house could not be verified. No approval was made.')
    const amount = Number(paymentData.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid rent amount. No approval was made.')
    const debitSnap = await tx.get(journalDebitRef)
    const creditSnap = await tx.get(journalCreditRef)
    if (debitSnap.exists() || creditSnap.exists()) throw new Error('A rent journal already exists for this payment. Review the ledger before retrying.')
    const now = Date.now()
    const journalId = `RENT-${paymentId}`
    const base = {
      propertyId: currentHouse.propertyId || 'default',
      createdBy: actionedBy?.uid || null,
      journalId,
      date: paymentData.month ? `${paymentData.month}-01` : new Date().toISOString().slice(0, 10),
      description: `Approved rent ${paymentData.month || ''} for ${currentHouse.internalDoorNumber || paymentData.houseId}`,
      category: 'Rent',
      houseId: paymentData.houseId || null,
      paymentId,
      entryType: 'journal-line',
      amount,
      createdAt: now,
      updatedAt: now,
    }
    tx.update(paymentRef, {
      status: 'approved',
      approvedAt: now,
      actionedBy: actionedBy || null,
      accountingJournalId: journalId,
      ...(neighborCollectedBy ? { neighborCollectedBy } : {}),
    })
    tx.set(journalDebitRef, { ...base, account: 'Cash / Bank', debit: amount, credit: 0 })
    tx.set(journalCreditRef, { ...base, account: 'Rental Income', debit: 0, credit: amount })
    return { paymentData, houseData: currentHouse }
  })

  // The approval transaction is the source of truth. Secondary effects must
  // not turn a successful approval into an apparent failure in the UI.
  if (result.paymentData?.tenantId) {
    try {
      await createNotification({
        recipientId: result.paymentData.tenantId,
        recipientType: 'tenant',
        type: 'rent_approved',
        title: 'Rent Approved',
        message: `Your rent payment for ${result.paymentData.month} has been approved.`
      })
    } catch (error) {
      console.warn('Rent approval succeeded, but tenant notification failed:', error?.message || error)
    }
  }

  try {
    const { logActivity } = await import('./activityLogService')
    await logActivity({
      action: 'approved',
      entityType: 'rent',
      entityId: paymentId,
      performedBy: actionedBy?.uid || null,
      performedByName: actionedBy?.name || 'Owner',
      details: `Approved rent payment for ${result.paymentData?.month}`,
      propertyId: result.houseData?.propertyId || 'default'
    })
  } catch (error) {
    console.warn('Rent approval succeeded, but activity logging failed:', error?.message || error)
  }
  invalidateRentApprovalCache()
}

export async function rejectPayment(paymentId, reason, actionedBy) {
  const paymentRef = doc(db, 'rentPayments', paymentId)
  const cleanReason = String(reason || '').trim()
  if (!paymentId || !cleanReason) throw new Error('A rejection reason is required.')

  // Revalidate inside a transaction so two owners cannot both act on a stale
  // pending item, and a rejected payment cannot overwrite a concurrent approval.
  const result = await runTransaction(db, async (tx) => {
    const paymentSnap = await tx.get(paymentRef)
    if (!paymentSnap.exists()) throw new Error('Rent payment not found.')
    const paymentData = paymentSnap.data()
    if (paymentData.status !== 'waiting_approval') {
      throw new Error('This payment is no longer pending approval. Refresh the queue and review its current status.')
    }
    const houseRef = paymentData.houseId ? doc(db, 'houses', paymentData.houseId) : null
    const houseSnap = houseRef ? await tx.get(houseRef) : null
    const houseData = houseSnap?.exists() ? houseSnap.data() : null
    if (!houseData) throw new Error('The payment house could not be verified. No rejection was made.')

    tx.update(paymentRef, {
      status: 'rejected',
      rejectionReason: cleanReason,
      actionedBy: actionedBy || null,
    })
    return { paymentData, houseData }
  })

  // Notifications and activity are secondary side effects. Their failure must
  // not make the UI imply the core rejection transaction was rolled back.
  if (result.paymentData?.tenantId) {
    try {
      await createNotification({
        recipientId: result.paymentData.tenantId,
        recipientType: 'tenant',
        type: 'rent_rejected',
        title: 'Rent Rejected',
        message: `Your rent payment for ${result.paymentData.month} was rejected. Reason: ${cleanReason}`
      })
    } catch (error) {
      console.warn('Rent rejection succeeded, but tenant notification failed:', error?.message || error)
    }
  }

  try {
    const { logActivity } = await import('./activityLogService')
    await logActivity({
      action: 'rejected',
      entityType: 'rent',
      entityId: paymentId,
      performedBy: actionedBy?.uid || null,
      performedByName: actionedBy?.name || 'Owner',
      details: `Rejected rent payment for ${result.paymentData?.month}. Reason: ${cleanReason}`,
      propertyId: result.houseData?.propertyId || 'default'
    })
  } catch (error) {
    console.warn('Rent rejection succeeded, but activity logging failed:', error?.message || error)
  }
  invalidateRentApprovalCache()
}

// Given a house + list of already-submitted months, figure out current-month status
// for the dashboard badge: 'paid' | 'waiting_approval' | 'not_paid'
export function resolveMonthStatus(payments, month) {
  const forMonth = payments.filter((p) => p.month === month)
  if (forMonth.some((p) => p.status === 'approved')) return 'paid'
  if (forMonth.some((p) => p.status === 'waiting_approval')) return 'waiting_approval'
  return 'not_paid'
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Counts consecutive months (walking backward from the current month) that
// don't have an approved payment, stopping at the first approved month found
// or after 12 months (whichever comes first) — used for the "Rent Pending"
// tenant list, which shows how many months behind someone is.
export function countMonthsPending(payments) {
  let count = 0
  let month = currentMonthStr()
  for (let i = 0; i < 12; i++) {
    const status = resolveMonthStatus(payments, month)
    if (status === 'approved' || status === 'paid') break
    if (status === 'not_paid') count++
    month = shiftMonth(month, -1)
  }
  return count
}

export async function getMonthlyPaymentTotal(houseId, month) {
  // Query only by houseId and filter month/status locally. This avoids another
  // composite-index dependency while keeping the read tightly scoped to one house.
  const snap = await getDocs(query(paymentsRef, where('houseId', '==', houseId)))
  return snap.docs.reduce((total, doc) => {
    const data = doc.data()
    if (data.month !== month || data.status !== 'approved') return total
    return total + (Number(data.amount) || 0)
  }, 0)
}

export function calculateLateFee(rentAmount, dueDate, paymentDate, config) {
  const { lateFeeType, lateFeeAmount, lateFeeGraceDays } = config
  const due = new Date(dueDate)
  const paid = new Date(paymentDate)
  
  // Calculate difference in days
  const diffTime = Math.max(0, paid.getTime() - due.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays <= lateFeeGraceDays) {
    return 0
  }
  
  if (lateFeeType === 'flat') {
    return lateFeeAmount
  } else if (lateFeeType === 'per_day') {
    // Subtract grace days? Usually grace days just mean no fee if within grace, otherwise fee from day 1 or day after grace?
    // Let's charge for all late days if they missed the grace period.
    return diffDays * lateFeeAmount
  }
  
  return 0
}
