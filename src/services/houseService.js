import {
  collection,
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
import { getActivePropertyId, getProperties } from './configService'

const housesRef = collection(db, 'houses')

// Keeps a safe-fields-only mirror in `directory` so tenants can browse neighbors
// without a Firestore rule ever exposing rentAmount/advanceAmount to them
// (rules can't redact individual fields on a single doc read).
async function syncDirectoryEntry(houseId, house) {
  await setDoc(doc(db, 'directory', houseId), {
    propertyId: house.propertyId || 'default',
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

export async function listHouses(propertyId) {
  const activePropertyId = propertyId || getActivePropertyId() || 'default'
  // Query by propertyId instead of downloading every house and filtering in the browser.
  // This is both faster and important for restricted owner accounts because Firestore
  // can now prove that the query is scoped to the selected property.
  const snap = await getDocs(query(housesRef, where('propertyId', '==', activePropertyId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.internalDoorNumber || '').localeCompare(String(b.internalDoorNumber || ''), undefined, { numeric: true }))
}

export async function listAllHouses() {
  const properties = await getProperties()
  const activeIds = properties.map((p) => p.id).filter(Boolean)
  if (!activeIds.length) return []
  const chunks = await Promise.all(activeIds.map(async (propertyId) => {
    const snap = await getDocs(query(housesRef, where('propertyId', '==', propertyId)))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }))
  return chunks.flat().sort((a, b) => String(a.internalDoorNumber || '').localeCompare(String(b.internalDoorNumber || ''), undefined, { numeric: true }))
}

export async function setHouseProperty(houseId, propertyId) {
  await updateDoc(doc(db, 'houses', houseId), { propertyId: propertyId || 'default', propertyUpdatedAt: Date.now() })
  const house = await getHouse(houseId)
  if (house) await syncDirectoryEntry(houseId, house)
}

export async function getHouse(houseId) {
  const snap = await getDoc(doc(db, 'houses', houseId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Create a brand new physical house record (done once per unit, not per tenant)
export async function createHouse({ govtDoorNumber, internalDoorNumber, floor, ebNumber, photos = [], propertyId }) {
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
    familyAccountCount: 0,
    phoneVisibleToNeighbors: true,
    propertyId: propertyId || getActivePropertyId() || 'default',
    ebShareOverrideMonths: null, // e.g. 1 => only occupied 1 of the 2 months in this bill cycle
    hasOwnEbMeter: false, // if true, this house is excluded from the shared EB split entirely
    createdAt: Date.now(),
  })
  const house = await getDoc(ref)
  await syncDirectoryEntry(ref.id, house.data())
  return ref
}

export async function updateHouse(houseId, { govtDoorNumber, internalDoorNumber, floor, ebNumber, photos = [], propertyId }) {
  await updateDoc(doc(db, 'houses', houseId), {
    ...(propertyId ? { propertyId } : {}),
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
export async function bookHouse(houseId, { tenantId, name, phone, email, rentAmount, advanceAmount, phoneVisibleToNeighbors = true, moveInDate, memberCount = 1, recordedBy, photoUrl }) {
  const houseUpdate = {
    status: 'occupied',
    currentTenantId: tenantId,
    tenantName: name,
    tenantPhone: phone,
    tenantEmail: email,
    tenantPhotoUrl: photoUrl || null,
    rentAmount,
    advanceAmount,
    memberCount: Number(memberCount || 1),
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
    memberCount: Number(memberCount || 1),
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

// Past tenants across every house — used by the "Old Tenants" tab.
//
// IMPORTANT: Do not use a collectionGroup(history) query here. Although the
// owner rules allow individual history reads, collection-group queries can be
// rejected by Firestore rules/index configuration and cause the entire Tenants
// screen to fail with "Missing or insufficient permissions". We already know
// the owner's houses, so read each house's history subcollection directly.
// This also removes the need for a composite index.
export async function listPastTenants() {
  const houses = await listHouses()
  const results = await Promise.all(
    houses.map(async (house) => {
      const snap = await getDocs(collection(db, 'houses', house.id, 'history'))
      return snap.docs
        .map((d) => ({ id: d.id, houseId: house.id, ...d.data() }))
        .filter((entry) => entry.movedOutAt != null)
    })
  )

  return results
    .flat()
    .sort((a, b) => Number(b.movedOutAt || 0) - Number(a.movedOutAt || 0))
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
    memberCount: 0,
    familyAccountCount: 0,
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


// Tenant-controlled: hide their phone number from the neighbor directory.
// It's always still visible to the owner via the full house doc.
export async function setPhoneVisibility(houseId, visible) {
  await updateDoc(doc(db, 'houses', houseId), { phoneVisibleToNeighbors: visible })
  const house = await getHouse(houseId)
  await syncDirectoryEntry(houseId, house)
}

// Safe-fields-only list for the tenant-facing neighbor directory / vacant house browser.
export async function listDirectory(propertyId) {
  const activePropertyId = propertyId || getActivePropertyId() || 'default'
  const snap = await getDocs(query(collection(db, 'directory'), orderBy('internalDoorNumber')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((entry) => (entry.propertyId || 'default') === activePropertyId)
}

export async function updateHouseDetails(houseId, { colors, fixtures, notes }) {
  await updateDoc(doc(db, 'houses', houseId), {
    houseColors: colors || {},
    providedFixtures: Array.isArray(fixtures) ? fixtures : [],
    ownerNotes: notes || '',
    detailsUpdatedAt: Date.now(),
  })
}

export async function setBlueprintVisibility(houseId, visible) {
  await updateDoc(doc(db, 'houses', houseId), { blueprintVisibleToTenants: !!visible })
}
