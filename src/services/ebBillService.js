import { collection, addDoc, getDocs, query, where, updateDoc, doc, writeBatch } from 'firebase/firestore'
import { db, auth } from './firebase'
import { getActivePropertyId } from './configService'
import { uploadPrivate } from './cloudinaryService'
import { listHouses } from './houseService'
import { createBulkNotifications } from './notificationService'

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

export async function createEbBillCycle({ cycleLabel, totalAmount, cycleMonths, dueDate, propertyId, previousMeterReading, currentMeterReading, meterReadingDate, meterReadingTime }) {
  const houses = await listHouses()
  const shares = calculateEbSplit(totalAmount, cycleMonths, houses)

  const docRef = await addDoc(billsRef, {
    cycleLabel, // e.g. 'Jul-Aug 2026'
    propertyId: propertyId || houses[0]?.propertyId || getActivePropertyId() || 'default',
    totalAmount,
    cycleMonths,
    dueDate,
    previousMeterReading: previousMeterReading === '' || previousMeterReading == null ? null : Number(previousMeterReading),
    currentMeterReading: currentMeterReading === '' || currentMeterReading == null ? null : Number(currentMeterReading),
    meterReadingDate: meterReadingDate || null,
    meterReadingTime: meterReadingTime || null,
    consumptionUnits: (previousMeterReading !== '' && previousMeterReading != null && currentMeterReading !== '' && currentMeterReading != null)
      ? (Number(currentMeterReading) >= Number(previousMeterReading) ? Number(currentMeterReading) - Number(previousMeterReading) : null)
      : null,
    shares,
    houseIds: shares.map((share) => share.houseId),
    createdAt: Date.now(),
  })

  // Notify tenants
  const notifications = shares
    .map(share => {
      const house = houses.find(h => h.id === share.houseId)
      if (house && house.tenantId) {
        return {
          recipientId: house.tenantId,
          recipientType: 'tenant',
          type: 'eb_bill_created',
          title: 'New EB Bill',
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

export async function listEbBillCycles(houseId = null) {
  const propertyId = getActivePropertyId() || 'default'
  const base = houseId ? query(billsRef, where('houseIds', 'array-contains', houseId)) : query(billsRef, where('propertyId', '==', propertyId))
  const snap = await getDocs(base)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

export function houseShareFromBill(bill, houseId) {
  return (Array.isArray(bill?.shares) ? bill.shares : []).find((s) => s.houseId === houseId) || null
}



// ---------- EB meter reading register ----------
// Readings are kept separately from government bill cycles so owners can record
// a meter observation whenever they physically inspect a meter. Queries use only
// houseId to avoid creating a composite Firestore index.
const ebMeterReadingsRef = collection(db, 'ebMeterReadings')

export async function listEbMeterReadings(houseId) {
  if (!houseId) return []
  const snap = await getDocs(query(ebMeterReadingsRef, where('houseId', '==', houseId)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.recordedAt || 0) - Number(a.recordedAt || 0))
}

export async function listEbMeterReadingsForHouses(houseIds = [], propertyId = null) {
  const ids = [...new Set(houseIds.filter(Boolean))]
  if (!ids.length) return []

  // Owner register queries are property-scoped instead of using a large
  // `where houseId in [...]` query. This is both faster for an apartment
  // workspace and more reliable with the property-scoped Firestore rules.
  // Keep the houseIds filter in memory so no composite index is required.
  const activePropertyId = propertyId || getActivePropertyId() || 'default'
  try {
    const snap = await getDocs(query(ebMeterReadingsRef, where('propertyId', '==', activePropertyId)))
    const allowed = new Set(ids)
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((row) => allowed.has(row.houseId))
      .sort((a, b) => Number(b.recordedAt || 0) - Number(a.recordedAt || 0))
  } catch (propertyQueryError) {
    // Compatibility fallback for records created before propertyId was added.
    // It is deliberately limited to the supplied house IDs and keeps the old
    // single-field query path available without changing security rules.
    const chunks = []
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
    const snapshots = await Promise.all(chunks.map((chunk) => getDocs(query(ebMeterReadingsRef, where('houseId', 'in', chunk)))))
    const rows = snapshots.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    return rows.sort((a, b) => Number(b.recordedAt || 0) - Number(a.recordedAt || 0))
  }
}

export async function recordEbMeterReading({ houseId, propertyId, reading, readingDate, readingTime, note = '' }) {
  const numericReading = Number(reading)
  if (!houseId || !Number.isFinite(numericReading) || numericReading < 0) {
    throw new Error('Enter a valid non-negative EB meter reading.')
  }
  if (!readingDate) throw new Error('Select the meter reading date.')
  const recordedAt = Date.now()
  const ref = await addDoc(ebMeterReadingsRef, {
    houseId,
    propertyId: propertyId || getActivePropertyId() || 'default',
    reading: numericReading,
    readingDate,
    readingTime: readingTime || null,
    note: String(note || '').slice(0, 500),
    recordedByUid: auth.currentUser?.uid || null,
    recordedAt,
  })
  return { id: ref.id, houseId, reading: numericReading, readingDate, readingTime: readingTime || null, note, recordedAt }
}

export async function recordEbMeterReadingsBulk(rows = [], propertyId) {
  const valid = rows.filter((row) => row?.houseId && row?.reading !== '' && Number.isFinite(Number(row.reading)) && Number(row.reading) >= 0 && row.readingDate)
  if (!valid.length) return []
  const batch = writeBatch(db)
  const now = Date.now()
  const refs = []
  for (const row of valid) {
    const ref = doc(ebMeterReadingsRef)
    refs.push(ref)
    batch.set(ref, {
      houseId: row.houseId,
      propertyId: row.propertyId || propertyId || getActivePropertyId() || 'default',
      reading: Number(row.reading),
      readingDate: row.readingDate,
      readingTime: row.readingTime || null,
      note: String(row.note || '').slice(0, 500),
      recordedByUid: auth.currentUser?.uid || null,
      recordedAt: now,
    })
  }
  await batch.commit()
  return valid.map((row, index) => ({ id: refs[index].id, ...row, reading: Number(row.reading), recordedAt: now }))
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
  let proofPublicId = null
  let proofResourceType = null
  if (proofFile) {
    const uploaded = await uploadPrivate(proofFile, `eb-proofs/${houseId}`)
    proofUrl = null
    proofPublicId = uploaded.publicId
    proofResourceType = uploaded.resourceType
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
    proofPublicId: proofPublicId || null,
    proofResourceType: proofResourceType || null,
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

export async function listPendingEbApprovals(houseIds = []) {
  const ids = [...new Set(houseIds.filter(Boolean))]
  if (!ids.length) return []
  const chunks = []
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(query(ebPaymentsRef, where('houseId', 'in', chunk))))
  )
  const seen = new Map()
  snapshots.forEach((snap) => snap.docs.forEach((d) => {
    const data = d.data()
    if (data.status === 'waiting_approval') seen.set(d.id, { id: d.id, ...data })
  }))
  return [...seen.values()].sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))
}

export async function listEbBillCyclesForHouses(houseIds = []) {
  const ids = [...new Set(houseIds.filter(Boolean))]
  if (!ids.length) return []
  const chunks = []
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(query(billsRef, where('houseIds', 'array-contains-any', chunk))))
  )
  const seen = new Map()
  snapshots.forEach((snap) => snap.docs.forEach((d) => seen.set(d.id, { id: d.id, ...d.data() })))
  return [...seen.values()].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

export async function listEbPaymentsForHouse(houseId) {
  const snap = await getDocs(query(ebPaymentsRef, where('houseId', '==', houseId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))
}

export async function listEbPaymentsForBill(billId) {
  const snap = await getDocs(query(ebBillPaymentsRef, where('billId', '==', billId)))
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
