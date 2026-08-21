import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import { uploadUnsigned } from './cloudinaryService'

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
  await updateDoc(doc(db, 'rentPayments', paymentId), {
    status: 'approved',
    approvedAt: Date.now(),
    actionedBy: actionedBy || null,
    ...(neighborCollectedBy ? { neighborCollectedBy } : {}),
  })
}

export async function rejectPayment(paymentId, reason, actionedBy) {
  await updateDoc(doc(db, 'rentPayments', paymentId), {
    status: 'rejected',
    rejectionReason: reason,
    actionedBy: actionedBy || null,
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
