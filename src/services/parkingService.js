import { collection, addDoc, getDocs, query, orderBy, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const parkingRef = collection(db, 'parkingSlots')

export async function createSlot({ slotNumber, type, floor = 'Ground', x = null, y = null }) {
  await addDoc(parkingRef, {
    slotNumber, type, floor, x, y,
    assignedHouseId: null,
    assignedTenantName: null,
    vehicleNumber: null,
    status: 'available'
  })
}

export async function listSlots() {
  const snap = await getDocs(query(parkingRef, orderBy('slotNumber', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function assignSlot(slotId, { houseId, tenantName, vehicleNumber }) {
  await updateDoc(doc(db, 'parkingSlots', slotId), {
    assignedHouseId: houseId,
    assignedTenantName: tenantName,
    vehicleNumber,
    status: 'assigned'
  })
}

export async function updateSlotPosition(slotId, { x, y }) {
  await updateDoc(doc(db, 'parkingSlots', slotId), { x, y })
}

export async function releaseSlot(slotId) {
  await updateDoc(doc(db, 'parkingSlots', slotId), {
    assignedHouseId: null,
    assignedTenantName: null,
    vehicleNumber: null,
    status: 'available'
  })
}
