import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'

const housesRef = collection(db, 'houses')

export async function listHouses() {
  const snap = await getDocs(query(housesRef, orderBy('internalDoorNumber')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getHouse(houseId) {
  const snap = await getDoc(doc(db, 'houses', houseId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Create a brand new physical house record (done once per unit, not per tenant)
export async function createHouse({ govtDoorNumber, internalDoorNumber, floor, ebNumber }) {
  return addDoc(housesRef, {
    govtDoorNumber,
    internalDoorNumber,
    floor,
    ebNumber,
    status: 'vacant',
    currentTenantId: null,
    rentAmount: 0,
    advanceAmount: 0,
    ebShareOverrideMonths: null, // e.g. 1 => only occupied 1 of the 2 months in this bill cycle
    hasOwnEbMeter: false, // if true, this house is excluded from the shared EB split entirely
    createdAt: Date.now(),
  })
}

// Book a vacant house: attach a new tenant profile without deleting history
export async function bookHouse(houseId, { tenantId, name, phone, email, rentAmount, advanceAmount }) {
  await updateDoc(doc(db, 'houses', houseId), {
    status: 'occupied',
    currentTenantId: tenantId,
    tenantName: name,
    tenantPhone: phone,
    tenantEmail: email,
    rentAmount,
    advanceAmount,
    movedInAt: Date.now(),
  })

  await addDoc(collection(db, 'houses', houseId, 'history'), {
    tenantId,
    name,
    phone,
    email,
    rentAmount,
    advanceAmount,
    movedInAt: Date.now(),
    movedOutAt: null,
  })
}

// Vacate: closes history entry, house becomes vacant.
// accessRevokeScheduledAt is picked up by the `revokeAccessAfterVacate` Cloud Function
// (runs every 15 min) which disables the tenant's Firebase Auth account 1hr after this call.
export async function vacateHouse(houseId, { advanceDeducted, deductionReason, balanceReturned, returnDate, returnMode, returnedBy }) {
  const house = await getHouse(houseId)

  await updateDoc(doc(db, 'houses', houseId), {
    status: 'vacant',
    currentTenantId: null,
    tenantName: null,
    tenantPhone: null,
    tenantEmail: null,
    accessRevokeScheduledAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
  })

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
    })
  }

  return house
}

export async function getHouseHistory(houseId) {
  const snap = await getDocs(
    query(collection(db, 'houses', houseId, 'history'), orderBy('movedInAt', 'desc'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateHouseRent(houseId, newRentAmount, effectiveMonth) {
  await updateDoc(doc(db, 'houses', houseId), {
    rentAmount: newRentAmount,
    rentEffectiveMonth: effectiveMonth,
    rentRevisionAnnouncedAt: Date.now(),
  })
}

export async function setEbOverride(houseId, { hasOwnEbMeter, ebShareOverrideMonths }) {
  await updateDoc(doc(db, 'houses', houseId), {
    hasOwnEbMeter: !!hasOwnEbMeter,
    ebShareOverrideMonths: ebShareOverrideMonths ?? null,
  })
}
