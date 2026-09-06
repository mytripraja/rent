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
} from 'firebase/firestore'
import { db } from './firebase'
import { uploadUnsigned } from './cloudinaryService'
import { createNotification } from './notificationService'

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
  if (proofFile) {
    const { url } = await uploadUnsigned(proofFile, `rent-proofs/${houseId}`)
    proofUrl = url
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

export async function listPendingApprovals() {
  const snap = await getDocs(query(paymentsRef, where('status', '==', 'waiting_approval')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function listRentHistory(houseId) {
  const snap = await getDocs(
    query(paymentsRef, where('houseId', '==', houseId), orderBy('submittedAt', 'desc'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function approvePayment(paymentId, { neighborCollectedBy, actionedBy } = {}) {
  const paymentRef = doc(db, 'rentPayments', paymentId)
  const snap = await getDoc(paymentRef)
  const paymentData = snap.data()

  await updateDoc(paymentRef, {
    status: 'approved',
    approvedAt: Date.now(),
    actionedBy: actionedBy || null,
    ...(neighborCollectedBy ? { neighborCollectedBy } : {}),
  })

  if (paymentData?.tenantId) {
    await createNotification({
      recipientId: paymentData.tenantId,
      recipientType: 'tenant',
      type: 'rent_approved',
      title: 'Rent Approved',
      message: `Your rent payment for ${paymentData.month} has been approved.`
    })
  }

  // Task 2: Log activity
  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'approved',
    entityType: 'rent',
    entityId: paymentId,
    performedBy: actionedBy?.uid || null,
    performedByName: actionedBy?.name || 'Owner',
    details: `Approved rent payment for ${paymentData?.month}`
  })
}

export async function rejectPayment(paymentId, reason, actionedBy) {
  const paymentRef = doc(db, 'rentPayments', paymentId)
  const snap = await getDoc(paymentRef)
  const paymentData = snap.data()

  await updateDoc(paymentRef, {
    status: 'rejected',
    rejectionReason: reason,
    actionedBy: actionedBy || null,
  })

  if (paymentData?.tenantId) {
    await createNotification({
      recipientId: paymentData.tenantId,
      recipientType: 'tenant',
      type: 'rent_rejected',
      title: 'Rent Rejected',
      message: `Your rent payment for ${paymentData.month} was rejected. Reason: ${reason}`
    })
  }

  // Task 2: Log activity
  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'rejected',
    entityType: 'rent',
    entityId: paymentId,
    performedBy: actionedBy?.uid || null,
    performedByName: actionedBy?.name || 'Owner',
    details: `Rejected rent payment for ${paymentData?.month}. Reason: ${reason}`
  })
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
  const snap = await getDocs(
    query(
      paymentsRef, 
      where('houseId', '==', houseId), 
      where('month', '==', month),
      where('status', '==', 'approved')
    )
  )
  return snap.docs.reduce((total, doc) => total + (Number(doc.data().amount) || 0), 0)
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
