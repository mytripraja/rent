import { collection, addDoc, getDocs, query, orderBy, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

function assetsRef(houseId) { return collection(db, 'houses', houseId, 'assets') }
function inspectionsRef(houseId) { return collection(db, 'houses', houseId, 'inspections') }

export async function listHouseAssets(houseId) {
  const snap = await getDocs(query(assetsRef(houseId), orderBy('name')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveHouseAsset(houseId, asset) {
  const payload = { name: String(asset.name || '').trim(), category: asset.category || 'Fixture', quantity: Number(asset.quantity || 1), condition: asset.condition || 'good', notes: asset.notes || '', updatedAt: Date.now() }
  if (!payload.name) throw new Error('Asset name is required.')
  if (asset.id) { await setDoc(doc(db, 'houses', houseId, 'assets', asset.id), payload, { merge: true }); return asset.id }
  const ref = await addDoc(assetsRef(houseId), { ...payload, createdAt: Date.now() }); return ref.id
}

export async function deleteHouseAsset(houseId, assetId) { await deleteDoc(doc(db, 'houses', houseId, 'assets', assetId)) }

export async function listHouseInspections(houseId) {
  const snap = await getDocs(query(inspectionsRef(houseId), orderBy('inspectedAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createHouseInspection(houseId, inspection) {
  const ref = await addDoc(inspectionsRef(houseId), { ...inspection, inspectedAt: inspection.inspectedAt || new Date().toISOString().slice(0, 10), createdAt: Date.now() })
  return ref.id
}

export async function getHouseInspection(houseId, inspectionId) {
  const snap = await getDoc(doc(db, 'houses', houseId, 'inspections', inspectionId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
