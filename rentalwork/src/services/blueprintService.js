import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const EMPTY = { floors: [{ id: 'ground', name: 'Ground floor', rooms: [], features: [] }], visibleToTenants: false, updatedAt: Date.now() }

export async function getHouseBlueprint(houseId) {
  const snap = await getDoc(doc(db, 'houseBlueprints', houseId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : { houseId, ...EMPTY }
}

export async function saveHouseBlueprint(houseId, blueprint, userId) {
  const payload = { ...blueprint, houseId, updatedAt: Date.now(), updatedBy: userId || null }
  await setDoc(doc(db, 'houseBlueprints', houseId), payload, { merge: true })
  return payload
}

export async function getPropertyBlueprint() {
  const snap = await getDoc(doc(db, 'propertyBlueprints', 'main'))
  return snap.exists() ? { id: snap.id, ...snap.data() } : { id: 'main', ...EMPTY }
}

export async function savePropertyBlueprint(blueprint, userId) {
  const payload = { ...blueprint, updatedAt: Date.now(), updatedBy: userId || null }
  await setDoc(doc(db, 'propertyBlueprints', 'main'), payload, { merge: true })
  return payload
}
