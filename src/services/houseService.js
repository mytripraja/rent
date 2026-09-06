import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'

const housesRef = collection(db, 'houses')

// Keeps a safe-fields-only mirror in `directory` so tenants can browse neighbors
// without a Firestore rule ever exposing rentAmount/advanceAmount to them
// (rules can't redact individual fields on a single doc read).
async function syncDirectoryEntry(houseId, house) {
  await setDoc(doc(db, 'directory', houseId), {
    internalDoorNumber: house.internalDoorNumber,
    govtDoorNumber: house.govtDoorNumber || null,
    floor: house.floor || null,
    status: house.status,
    tenantName: house.status === 'occupied' ? house.tenantName : null,
    tenantPhone: house.status === 'occupied' && house.phoneVisibleToNeighbors ? house.tenantPhone : null,
    phoneVisibleToNeighbors: !!house.phoneVisibleToNeighbors,
    photos: house.photos || [],
    rentAmount: house.status === 'vacant' ? (house.rentAmount || 0) : null,
  })
}

export async function listHouses() {
  const snap = await getDocs(query(housesRef, orderBy('internalDoorNumber')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getHouse(houseId) {
  const snap = await getDoc(doc(db, 'houses', houseId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Create a brand new physical house record (done once per unit, not per tenant)
export async function createHouse({ govtDoorNumber, internalDoorNumber, floor, ebNumber, photos = [] }) {
  const ref = await addDoc(housesRef, {
    govtDoorNumber,
    internalDoorNumber,
    floor,
    ebNumber,
    photos,
    status: 'vacant',
    currentTenantId: null,
    rentAmount: 0,
    advanceAmount: 0,
    phoneVisibleToNeighbors: true,
    ebShareOverrideMonths: null, // e.g. 1 => only occupied 1 of the 2 months in this bill cycle
    hasOwnEbMeter: false, // if true, this house is excluded from the shared EB split entirely
    createdAt: Date.now(),
  })
  const house = await getDoc(ref)
  await syncDirectoryEntry(ref.id, house.data())
  return ref
}

export async function updateHouse(houseId, { govtDoorNumber, internalDoorNumber, floor, ebNumber, photos = [] }) {
  await updateDoc(doc(db, 'houses', houseId), {
    govtDoorNumber,
    internalDoorNumber,
    floor,
    ebNumber,
    photos,
  })
  const house = await getHouse(houseId)
  if (house) {
    await syncDirectoryEntry(houseId, house)
  }
}

export async function setEbOverride(houseId, data) {
  await updateDoc(doc(db, 'houses', houseId), data)
}

export async function setWaterOverride(houseId, data) {
  await updateDoc(doc(db, 'houses', houseId), data)
}

export async function deleteHouse(houseId) {
  await deleteDoc(doc(db, 'houses', houseId))
  await deleteDoc(doc(db, 'directory', houseId))
}


// Book a vacant house: attach a new tenant profile without deleting history
export async function bookHouse(houseId, { tenantId, name, phone, email, rentAmount, advanceAmount, phoneVisibleToNeighbors = true, moveInDate, recordedBy, photoUrl }) {
  const houseUpdate = {
    status: 'occupied',
    currentTenantId: tenantId,
    tenantName: name,
    tenantPhone: phone,
    tenantEmail: email,
    tenantPhotoUrl: photoUrl || null,
    rentAmount,
    advanceAmount,
    phoneVisibleToNeighbors,
    moveInDate: moveInDate || null, // the date they actually moved in, as entered by the owner
    movedInAt: Date.now(),
  }
  await updateDoc(doc(db, 'houses', houseId), houseUpdate)

  const house = await getHouse(houseId)
  await syncDirectoryEntry(houseId, house)

  await addDoc(collection(db, 'houses', houseId, 'history'), {
    tenantId,
    name,
    phone,
    email,
    photoUrl: photoUrl || null,
    rentAmount,
    advanceAmount,
    moveInDate: moveInDate || null,
    movedInAt: Date.now(),
    movedOutAt: null,
    recordedBy: recordedBy || null,
  })

  // Task 2: Log activity
  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'booked',
    entityType: 'house',
    entityId: houseId,
    performedBy: recordedBy?.uid || null,
    performedByName: recordedBy?.name || 'Owner',
    details: `Booked house ${house?.internalDoorNumber || houseId} for ${name}`
  })
}

// Past tenants across every house — used by the "Old Tenants" tab. Reads the
// `history` subcollection across all houses at once via a collection group
// query. Firestore will prompt you to create a composite index the first time
// this runs (console link appears in the error) — click it once and it's done.
export async function listPastTenants() {
  const snap = await getDocs(
    query(collectionGroup(db, 'history'), where('movedOutAt', '!=', null), orderBy('movedOutAt', 'desc'))
  )
  return snap.docs.map((d) => ({ id: d.id, houseId: d.ref.parent.parent.id, ...d.data() }))
}

// Vacate: closes history entry, house becomes vacant.
// accessRevokeScheduledAt is picked up by the `revokeAccessAfterVacate` Cloud Function
// (runs every 15 min) which disables the tenant's Firebase Auth account 1hr after this call.
export async function vacateHouse(houseId, { advanceDeducted, deductionReason, balanceReturned, returnDate, returnMode, returnedBy, recordedBy }) {
  const house = await getHouse(houseId)
  const tenantName = house?.tenantName

  await updateDoc(doc(db, 'houses', houseId), {
    status: 'vacant',
    currentTenantId: null,
    tenantName: null,
    tenantPhone: null,
    tenantEmail: null,
    accessRevokeScheduledAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
  })

  await syncDirectoryEntry(houseId, { internalDoorNumber: house.internalDoorNumber, status: 'vacant' })

  // Close the most recent open history entry
  const historySnap = await getDocs(
    query(collection(db, 'houses', houseId, 'history'), where('movedOutAt', '==', null))
  )
  for (const d of historySnap.docs) {
    await updateDoc(d.ref, {
      movedOutAt: Date.now(),
      advanceDeducted,
      deductionReason,
      balanceReturned,
      returnDate,
      returnMode, // 'cash' | 'upi'
      returnedBy, // 'deepu' | 'rajavel' | 'siva' | ...
      vacatedBy: recordedBy || null,
    })
  }

  // Task 2: Log activity
  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'vacated',
    entityType: 'house',
    entityId: houseId,
    performedBy: recordedBy?.uid || null,
    performedByName: recordedBy?.name || 'Owner',
    details: `Vacated house ${house?.internalDoorNumber || houseId} (was ${tenantName})`
  })

  return house
}

export async function getHouseHistory(houseId) {
  const snap = await getDocs(
    query(collection(db, 'houses', houseId, 'history'), orderBy('movedInAt', 'desc'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Announce a future rent increase without changing the current rent yet.
// The tenant sees a banner ("From July, rent will be ₹X") until you apply it.
export async function announceRentRevision(houseId, newRentAmount, effectiveMonth) {
  await updateDoc(doc(db, 'houses', houseId), {
    pendingRentAmount: newRentAmount,
    pendingRentEffectiveMonth: effectiveMonth, // e.g. '2026-09'
    rentRevisionAnnouncedAt: Date.now(),
  })
}

// Call once the effective month arrives to actually switch the standing rent.
// Kept as a manual owner action rather than a cron job, so you stay in control
// of exactly when it takes effect.
export async function applyRentRevision(houseId) {
  const house = await getHouse(houseId)
  if (!house?.pendingRentAmount) return
  await updateDoc(doc(db, 'houses', houseId), {
    rentAmount: house.pendingRentAmount,
    pendingRentAmount: null,
    pendingRentEffectiveMonth: null,
  })
}

export async function cancelRentRevision(houseId) {
  await updateDoc(doc(db, 'houses', houseId), {
    pendingRentAmount: null,
    pendingRentEffectiveMonth: null,
  })
}

export async function setEbOverride(houseId, { hasOwnEbMeter, ebShareOverrideMonths }) {
  await updateDoc(doc(db, 'houses', houseId), {
    hasOwnEbMeter: !!hasOwnEbMeter,
    ebShareOverrideMonths: ebShareOverrideMonths ?? null,
  })
}

// Tenant-controlled: hide their phone number from the neighbor directory.
// It's always still visible to the owner via the full house doc.
export async function setPhoneVisibility(houseId, visible) {
  await updateDoc(doc(db, 'houses', houseId), { phoneVisibleToNeighbors: visible })
  const house = await getHouse(houseId)
  await syncDirectoryEntry(houseId, house)
}

// Safe-fields-only list for the tenant-facing neighbor directory / vacant house browser.
export async function listDirectory() {
  const snap = await getDocs(query(collection(db, 'directory'), orderBy('internalDoorNumber')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
