import { collection, addDoc, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'
import { uploadUnsigned } from './cloudinaryService'
import { listHouses } from './houseService'

const billsRef = collection(db, 'ebBills')

/**
 * Splits a shared EB bill across all eligible houses.
 *
 * Rules:
 * - Houses with hasOwnEbMeter = true are excluded entirely (they pay their own bill, tracked separately).
 * - Standard cycle is 2 months. A house that only occupied part of the cycle
 *   (house.ebShareOverrideMonths, e.g. 1) gets a proportionally smaller share.
 * - The amount "saved" by that partial house is redistributed across the remaining
 *   full-cycle houses so the full bill is still collected.
 *
 * @param {number} totalAmount - total EB bill for the cycle
 * @param {number} cycleMonths - normally 2
 * @param {Array} houses - from listHouses(), each with { id, status, hasOwnEbMeter, ebShareOverrideMonths }
 */
export function calculateEbSplit(totalAmount, cycleMonths, houses) {
  const eligible = houses.filter((h) => h.status === 'occupied' && !h.hasOwnEbMeter)
  const n = eligible.length
  if (n === 0) return []

  const baseShare = totalAmount / n

  // Sum of "missing" amount from partial-cycle houses
  let shortfall = 0
  const partial = []
  const fullShareHouses = []

  eligible.forEach((h) => {
    const monthsOccupied = h.ebShareOverrideMonths ?? cycleMonths
    if (monthsOccupied < cycleMonths) {
      const proratedShare = baseShare * (monthsOccupied / cycleMonths)
      shortfall += baseShare - proratedShare
      partial.push({ houseId: h.id, internalDoorNumber: h.internalDoorNumber, monthsOccupied, shareAmount: round2(proratedShare) })
    } else {
      fullShareHouses.push(h)
    }
  })

  // Redistribute shortfall across full-cycle houses only
  const redistributionPerHouse = fullShareHouses.length > 0 ? shortfall / fullShareHouses.length : 0

  const fullShares = fullShareHouses.map((h) => ({
    houseId: h.id,
    internalDoorNumber: h.internalDoorNumber,
    monthsOccupied: cycleMonths,
    shareAmount: round2(baseShare + redistributionPerHouse),
  }))

  return [...fullShares, ...partial].sort((a, b) =>
    String(a.internalDoorNumber).localeCompare(String(b.internalDoorNumber))
  )
}

function round2(n) {
  return Math.round(n * 100) / 100
}

export async function createEbBillCycle({ cycleLabel, totalAmount, cycleMonths, dueDate }) {
  const houses = await listHouses()
  const shares = calculateEbSplit(totalAmount, cycleMonths, houses)

  const docRef = await addDoc(billsRef, {
    cycleLabel, // e.g. 'Jul-Aug 2026'
    totalAmount,
    cycleMonths,
    dueDate,
    shares,
    createdAt: Date.now(),
  })

  return { id: docRef.id, shares }
}

export async function listEbBillCycles() {
  const snap = await getDocs(query(billsRef, orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function houseShareFromBill(bill, houseId) {
  return bill.shares.find((s) => s.houseId === houseId) || null
}

// ---------- EB bill payments (mirrors rentService, tagged to a billId) ----------

const ebPaymentsRef = collection(db, 'ebBillPayments')

function generateEbApplicationNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `EB-${Date.now().toString().slice(-6)}-${rand}`
}

export async function submitEbPayment({
  billId,
  houseId,
  tenantId,
  amount,
  dateSent,
  mode, // 'upi' | 'bank' | 'cash' | 'neighbor'
  cashReceivedBy,
  neighborHouseId,
  proofFile,
  uploadedByOwner = false,
  recordedBy,
}) {
  let proofUrl = null
  if (proofFile) {
    const { url } = await uploadUnsigned(proofFile, `eb-proofs/${houseId}`)
    proofUrl = url
  }

  const applicationNumber = generateEbApplicationNumber()

  await addDoc(ebPaymentsRef, {
    billId,
    houseId,
    tenantId,
    amount,
    dateSent,
    mode,
    cashReceivedBy: mode === 'cash' ? cashReceivedBy : null,
    neighborHouseId: mode === 'neighbor' ? neighborHouseId : null,
    neighborCollectedBy: null,
    proofUrl,
    applicationNumber,
    status: 'waiting_approval',
    uploadedByOwner,
    recordedBy: recordedBy || null,
    rejectionReason: null,
    submittedAt: Date.now(),
    approvedAt: null,
    actionedBy: null,
  })

  return applicationNumber
}

export async function listPendingEbApprovals() {
  const snap = await getDocs(query(ebPaymentsRef, where('status', '==', 'waiting_approval')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function listEbPaymentsForHouse(houseId) {
  const snap = await getDocs(
    query(ebPaymentsRef, where('houseId', '==', houseId), orderBy('submittedAt', 'desc'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function approveEbPayment(paymentId, { neighborCollectedBy, actionedBy } = {}) {
  await updateDoc(doc(db, 'ebBillPayments', paymentId), {
    status: 'approved',
    approvedAt: Date.now(),
    actionedBy: actionedBy || null,
    ...(neighborCollectedBy ? { neighborCollectedBy } : {}),
  })
}

export async function rejectEbPayment(paymentId, reason, actionedBy) {
  await updateDoc(doc(db, 'ebBillPayments', paymentId), {
    status: 'rejected',
    rejectionReason: reason,
    actionedBy: actionedBy || null,
  })
}
