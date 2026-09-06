import { collection, addDoc, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'
import { uploadUnsigned } from './cloudinaryService'
import { listHouses } from './houseService'
import { createBulkNotifications } from './notificationService'

const billsRef = collection(db, 'waterBills')

export function calculateWaterSplit(totalAmount, cycleMonths, houses) {
  const eligible = houses.filter((h) => h.status === 'occupied')
  const n = eligible.length
  if (n === 0) return []

  const baseShare = totalAmount / n

  let shortfall = 0
  const partial = []
  const fullShareHouses = []

  eligible.forEach((h) => {
    const monthsOccupied = h.waterShareOverrideMonths ?? h.ebShareOverrideMonths ?? cycleMonths
    if (monthsOccupied < cycleMonths) {
      const proratedShare = baseShare * (monthsOccupied / cycleMonths)
      shortfall += baseShare - proratedShare
      partial.push({ houseId: h.id, internalDoorNumber: h.internalDoorNumber, monthsOccupied, shareAmount: round2(proratedShare) })
    } else {
      fullShareHouses.push(h)
    }
  })

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

export async function createWaterBillCycle({ cycleLabel, totalAmount, cycleMonths, dueDate }) {
  const houses = await listHouses()
  const shares = calculateWaterSplit(totalAmount, cycleMonths, houses)

  const docRef = await addDoc(billsRef, {
    cycleLabel,
    totalAmount,
    cycleMonths,
    dueDate,
    shares,
    createdAt: Date.now(),
  })

  const notifications = shares
    .map(share => {
      const house = houses.find(h => h.id === share.houseId)
      if (house && house.tenantId) {
        return {
          recipientId: house.tenantId,
          recipientType: 'tenant',
          type: 'water_bill_created',
          title: 'New Water Bill',
          message: `Your share for ${cycleLabel} is ₹${share.shareAmount}`
        }
      }
      return null
    })
    .filter(Boolean)

  if (notifications.length > 0) {
    await createBulkNotifications(notifications)
  }

  return { id: docRef.id, shares }
}

export async function listWaterBillCycles() {
  const snap = await getDocs(query(billsRef, orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function houseShareFromWaterBill(bill, houseId) {
  return bill.shares.find((s) => s.houseId === houseId) || null
}

const waterPaymentsRef = collection(db, 'waterBillPayments')

function generateWaterApplicationNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `WB-${Date.now().toString().slice(-6)}-${rand}`
}

export async function submitWaterPayment({
  billId,
  houseId,
  tenantId,
  amount,
  dateSent,
  mode,
  cashReceivedBy,
  neighborHouseId,
  proofFile,
  uploadedByOwner = false,
  recordedBy,
}) {
  let proofUrl = null
  if (proofFile) {
    const { url } = await uploadUnsigned(proofFile, `water-proofs/${houseId}`)
    proofUrl = url
  }

  const applicationNumber = generateWaterApplicationNumber()

  await addDoc(waterPaymentsRef, {
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

export async function listPendingWaterApprovals() {
  const snap = await getDocs(query(waterPaymentsRef, where('status', '==', 'waiting_approval')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function listWaterPaymentsForHouse(houseId) {
  const snap = await getDocs(
    query(waterPaymentsRef, where('houseId', '==', houseId), orderBy('submittedAt', 'desc'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function approveWaterPayment(paymentId, { neighborCollectedBy, actionedBy } = {}) {
  await updateDoc(doc(db, 'waterBillPayments', paymentId), {
    status: 'approved',
    approvedAt: Date.now(),
    actionedBy: actionedBy || null,
    ...(neighborCollectedBy ? { neighborCollectedBy } : {}),
  })
}

export async function rejectWaterPayment(paymentId, reason, actionedBy) {
  await updateDoc(doc(db, 'waterBillPayments', paymentId), {
    status: 'rejected',
    rejectionReason: reason,
    actionedBy: actionedBy || null,
  })
}
