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
import { db, auth, authedFetch } from './firebase'
import { getActivePropertyId, getProperties } from './configService'
import { cachedRequest, invalidateCache } from './performanceCache'

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

let ownerHouseAccessCache = null
let ownerHouseAccessCacheAt = 0

async function canReadLegacyHouseRecords() {
  const now = Date.now()
  if (ownerHouseAccessCache && now - ownerHouseAccessCacheAt < 15000) return ownerHouseAccessCache
  const uid = auth.currentUser?.uid
  if (!uid) return false
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const profile = snap.exists() ? snap.data() : {}
    // Admins and legacy owners without propertyAccess are allowed to read all
    // properties by firestore.rules. This lets us safely include older house
    // records that pre-date the propertyId field and are therefore logically
    // assigned to the default apartment. Restricted co-owners must stay on the
    // propertyId query so the database remains the security boundary.
    const allowed = profile.role === 'admin' || (profile.role === 'owner' && !Object.prototype.hasOwnProperty.call(profile, 'propertyAccess'))
    ownerHouseAccessCache = allowed
    ownerHouseAccessCacheAt = now
    return allowed
  } catch {
    return false
  }
}

function sortHouses(houses) {
  return houses.sort((a, b) => String(a.internalDoorNumber || '').localeCompare(String(b.internalDoorNumber || ''), undefined, { numeric: true }))
}

export async function listOwnerHousesSecure() {
  const result = await authedFetch('/api/owner-houses', {})
  return sortHouses(result.houses || [])
}

export async function listHouses(propertyId) {
  const activePropertyId = propertyId || getActivePropertyId() || 'default'
  return cachedRequest(`houses:${activePropertyId}`, async () => {
    // Primary path stays property-scoped for performance and restricted-owner security.
    let snap
    try {
      snap = await getDocs(query(housesRef, where('propertyId', '==', activePropertyId)))
    } catch (error) {
      // Owner/admin fallback for deployments where a legacy Firestore rule/query
      // is temporarily out of sync. The server applies the same property boundary.
      const result = await authedFetch('/api/owner-houses', {})
      return sortHouses((result.houses || []).filter(h => String(h.propertyId || 'default') === String(activePropertyId)))
    }
    const houses = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    // Backward compatibility: V8.10 introduced propertyId, but existing houses
    // created before that release have no propertyId field. Firestore cannot query
    // for a missing field. For admin/legacy all-property owners, read the collection
    // only when viewing the default apartment and merge those legacy records.
    if (activePropertyId === 'default' && await canReadLegacyHouseRecords()) {
      const knownIds = new Set(houses.map((h) => h.id))
      const legacySnap = await getDocs(housesRef)
      const legacy = legacySnap.docs
        .filter((d) => !d.data().propertyId && !knownIds.has(d.id))
        .map((d) => ({ id: d.id, ...d.data(), propertyId: 'default' }))
      return sortHouses(houses.concat(legacy))
    }

    return sortHouses(houses)
  }, 30000)
}

export async function listAllHouses() {
  return cachedRequest('houses:all', async () => {
    const properties = await getProperties()
    const activeIds = properties.map((p) => p.id).filter(Boolean)
    if (!activeIds.length) return []
    const chunks = await Promise.all(activeIds.map(async (propertyId) => {
      const snap = await getDocs(query(housesRef, where('propertyId', '==', propertyId)))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    }))
    let houses = chunks.flat()
    if (activeIds.includes('default') && await canReadLegacyHouseRecords()) {
      const knownIds = new Set(houses.map((h) => h.id))
      const legacySnap = await getDocs(housesRef)
      houses = houses.concat(legacySnap.docs
        .filter((d) => !d.data().propertyId && !knownIds.has(d.id))
        .map((d) => ({ id: d.id, ...d.data(), propertyId: 'default' })))
    }
    return sortHouses(houses)
  }, 30000)
}

export async function setHouseProperty(houseId, propertyId) {
  await updateDoc(doc(db, 'houses', houseId), { propertyId: propertyId || 'default', propertyUpdatedAt: Date.now() })
  const house = await getHouse(houseId)
  if (house) await syncDirectoryEntry(houseId, house)
  invalidateCache('houses:')
}

export async function getHouse(houseId) {
  const snap = await getDoc(doc(db, 'houses', houseId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Tenant-safe house profile. Tenants intentionally cannot read houses/{id}
// directly because that document contains rent, advance and owner-only fields.
export async function getTenantHouseProfile() {
  const result = await authedFetch('/api/tenant-rent-status', { action: 'house' })
  return result.house || null
}

// Create a brand new physical house record (done once per unit, not per tenant)
export async function createHouse({ govtDoorNumber, internalDoorNumber, floor, ebNumber, photos = [], propertyId, roomCounts = {} }) {
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
    roomCounts: {
      bedrooms: Number(roomCounts.bedrooms || 0),
      halls: Number(roomCounts.halls || 0),
      kitchens: Number(roomCounts.kitchens || 0),
      bathrooms: Number(roomCounts.bathrooms || 0),
      dressingRooms: Number(roomCounts.dressingRooms || 0),
    },
    createdAt: Date.now(),
  })
  const house = await getDoc(ref)
  await syncDirectoryEntry(ref.id, house.data())
  invalidateCache('houses:')
  return ref
}

export async function updateHouse(houseId, { govtDoorNumber, internalDoorNumber, floor, ebNumber, photos = [], propertyId, roomCounts = {} }) {
  await updateDoc(doc(db, 'houses', houseId), {
    ...(propertyId ? { propertyId } : {}),
    govtDoorNumber,
    internalDoorNumber,
    floor,
    ebNumber,
    photos,
    roomCounts: {
      bedrooms: Number(roomCounts.bedrooms || 0),
      halls: Number(roomCounts.halls || 0),
      kitchens: Number(roomCounts.kitchens || 0),
      bathrooms: Number(roomCounts.bathrooms || 0),
      dressingRooms: Number(roomCounts.dressingRooms || 0),
    },
  })
  const house = await getHouse(houseId)
  if (house) {
    await syncDirectoryEntry(houseId, house)
  }
  invalidateCache('houses:')
}

export async function setEbOverride(houseId, data) {
  await updateDoc(doc(db, 'houses', houseId), data)
  invalidateCache('houses:')
}

export async function setWaterOverride(houseId, data) {
  await updateDoc(doc(db, 'houses', houseId), data)
  invalidateCache('houses:')
}

export async function deleteHouse(houseId) {
  await deleteDoc(doc(db, 'houses', houseId))
  await deleteDoc(doc(db, 'directory', houseId))
  invalidateCache('houses:')
}


// Book a vacant house: attach a new tenant profile without deleting history
export async function bookHouse(houseId, { tenantId, name, phone, email, rentAmount, advanceAmount, phoneVisibleToNeighbors = true, moveInDate, moveInDateApproximate = false, memberCount = 1, householdMembers = [], recordedBy, photoUrl }) {
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
    moveInDate: moveInDate || null, // exact or approximate date entered by the owner
    moveInDateApproximate: !!moveInDateApproximate,
    householdMembers: Array.isArray(householdMembers) ? householdMembers : [],
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
    moveInDateApproximate: !!moveInDateApproximate,
    householdMembers: Array.isArray(householdMembers) ? householdMembers : [],
    movedInAt: Date.now(),
    movedOutAt: null,
    recordedBy: recordedBy || null,
  })

  invalidateCache('houses:')

  // Task 2: Log activity
  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'booked',
    entityType: 'house',
    entityId: houseId,
    performedBy: recordedBy?.uid || null,
    performedByName: recordedBy?.name || 'Owner',
    details: `Booked house ${house?.internalDoorNumber || houseId} for ${name}`,
    propertyId: house?.propertyId || 'default'
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
    householdMembers: [],
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

  invalidateCache('houses:')

  // Task 2: Log activity
  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'vacated',
    entityType: 'house',
    entityId: houseId,
    performedBy: recordedBy?.uid || null,
    performedByName: recordedBy?.name || 'Owner',
    details: `Vacated house ${house?.internalDoorNumber || houseId} (was ${tenantName})`,
    propertyId: house?.propertyId || 'default'
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
export async function announceRentRevision(houseId, newRentAmount, effectiveMonth, nextIncreaseMonth = '') {
  await updateDoc(doc(db, 'houses', houseId), {
    pendingRentAmount: newRentAmount,
    pendingRentEffectiveMonth: effectiveMonth,
    pendingNextRentIncreaseMonth: nextIncreaseMonth || null,
    rentRevisionAnnouncedAt: Date.now(),
  })
}

// Call once the effective month arrives to actually switch the standing rent.
// Kept as a manual owner action rather than a cron job, so you stay in control
// of exactly when it takes effect.
export async function applyRentRevision(houseId) {
  const house = await getHouse(houseId)
  if (!house?.pendingRentAmount) return
  const history = Array.isArray(house.rentIncreaseHistory) ? house.rentIncreaseHistory : []
  await updateDoc(doc(db, 'houses', houseId), {
    rentAmount: house.pendingRentAmount,
    pendingRentAmount: null,
    pendingRentEffectiveMonth: null,
    nextRentIncreaseMonth: house.pendingNextRentIncreaseMonth || null,
    pendingNextRentIncreaseMonth: null,
    rentIncreaseHistory: [...history, { fromAmount: Number(house.rentAmount || 0), toAmount: Number(house.pendingRentAmount || 0), effectiveMonth: house.pendingRentEffectiveMonth || null, recordedAt: Date.now() }].slice(-30),
  })
}

export async function cancelRentRevision(houseId) {
  await updateDoc(doc(db, 'houses', houseId), {
    pendingRentAmount: null,
    pendingRentEffectiveMonth: null,
    pendingNextRentIncreaseMonth: null,
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
  const snap = await getDocs(query(collection(db, 'directory'), where('propertyId', '==', activePropertyId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.internalDoorNumber || '').localeCompare(String(b.internalDoorNumber || ''), undefined, { numeric: true }))
}

export async function updateHouseholdMembers(houseId, members) {
  const normalized = (Array.isArray(members) ? members : []).map((m, index) => {
    const age = Number(m.age)
    const band = Number.isFinite(age) ? ageBandForHouse(age) : null
    return { ...m, age: Number.isFinite(age) ? age : null, ageBand: band?.id || null, ageBandLabel: band?.label || null, ageBandRange: band?.range || null, order: index + 1 }
  })
  await updateDoc(doc(db, 'houses', houseId), { householdMembers: normalized, memberCount: normalized.length, familyMemberCount: normalized.length, householdUpdatedAt: Date.now() })
  invalidateCache('houses:')
}
function ageBandForHouse(age) {
  if (age <= 2) return { id:'baby', label:'Baby', range:'0–2 years' }
  if (age <= 17) return { id:'kid', label:'Kid', range:'3–17 years' }
  if (age <= 59) return { id:'adult', label:'Adult', range:'18–59 years' }
  if (age <= 74) return { id:'senior', label:'Senior Citizen', range:'60–74 years' }
  return { id:'super-senior', label:'Super Senior Citizen', range:'75+ years' }
}

export async function updateHouseDetails(houseId, { colors, fixtures, notes }) {
  await updateDoc(doc(db, 'houses', houseId), {
    houseColors: colors || {},
    providedFixtures: Array.isArray(fixtures) ? fixtures : [],
    ownerNotes: notes || '',
    detailsUpdatedAt: Date.now(),
  })
  invalidateCache('houses:')
}

export async function setBlueprintVisibility(houseId, visible) {
  await updateDoc(doc(db, 'houses', houseId), { blueprintVisibleToTenants: !!visible })
}
