import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { getActivePropertyId } from './configService'

function currentPropertyId(propertyId) {
  return propertyId || getActivePropertyId() || 'default'
}

export async function getApartmentOperations(propertyId) {
  const id = currentPropertyId(propertyId)
  const ref = doc(db, 'apartmentOperations', id)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : {
    id,
    propertyId: id,
    motors: [],
    tanks: [],
    settings: { targetReading: 15, targetUnit: 'kW', tolerance: 0, retryMin: 5, retryMax: 10 }
  }
}

export async function saveApartmentOperations(propertyId, data) {
  const id = currentPropertyId(propertyId)
  await setDoc(doc(db, 'apartmentOperations', id), { ...data, propertyId: id, updatedAt: Date.now() }, { merge: true })
}

export async function recordMotorCommand(propertyId, motorId, command, details = {}) {
  const id = currentPropertyId(propertyId)
  const ref = await addDoc(collection(db, 'motorCommands'), {
    propertyId: id,
    motorId,
    command,
    ...details,
    createdAt: Date.now(),
    createdBy: details.createdBy || null,
  })
  return ref.id
}

export async function listApartmentIssues(propertyId, houseId = '') {
  const id = currentPropertyId(propertyId)
  const snap = await getDocs(collection(db, 'propertyIssues'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(item => (item.propertyId || 'default') === id && (!houseId || item.houseId === houseId))
    .sort((a,b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')))
}

export async function saveApartmentIssue(propertyId, issue) {
  const id = currentPropertyId(propertyId)
  const payload = {
    propertyId: id,
    houseId: issue.houseId || null,
    title: String(issue.title || '').trim(),
    category: issue.category || 'Other',
    severity: issue.severity || 'medium',
    occurredAt: issue.occurredAt || new Date().toISOString().slice(0, 16),
    durationMinutes: Number(issue.durationMinutes || 0),
    recurrence: issue.recurrence || 'one-time',
    status: issue.status || 'open',
    rootCause: issue.rootCause || '',
    actionTaken: issue.actionTaken || '',
    followUpDate: issue.followUpDate || '',
    notes: issue.notes || '',
    futureFlag: !!issue.futureFlag,
    updatedAt: Date.now(),
  }
  if (!payload.title) throw new Error('Problem title is required.')
  if (issue.id) {
    await updateDoc(doc(db, 'propertyIssues', issue.id), payload)
    return issue.id
  }
  const ref = await addDoc(collection(db, 'propertyIssues'), { ...payload, createdAt: Date.now() })
  return ref.id
}

export async function deleteApartmentIssue(id) {
  await deleteDoc(doc(db, 'propertyIssues', id))
}

export async function listCctvCameras(propertyId) {
  const id = currentPropertyId(propertyId)
  const snap = await getDocs(collection(db, 'cctvCameras'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => (item.propertyId || 'default') === id).sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')))
}

export async function saveCctvCamera(propertyId, camera) {
  const id = currentPropertyId(propertyId)
  const payload = {
    propertyId: id,
    houseId: camera.houseId || null,
    name: String(camera.name || '').trim(),
    location: camera.location || '',
    direction: camera.direction || '',
    mainBoxLocation: camera.mainBoxLocation || '',
    loginUsername: camera.loginUsername || '',
    credentialVaultRef: camera.credentialVaultRef || '',
    purchaseDate: camera.purchaseDate || '',
    warrantyMonths: Number(camera.warrantyMonths || 12),
    notes: camera.notes || '',
    updatedAt: Date.now(),
  }
  if (!payload.name) throw new Error('Camera name is required.')
  if (camera.id) {
    await updateDoc(doc(db, 'cctvCameras', camera.id), payload)
    return camera.id
  }
  const ref = await addDoc(collection(db, 'cctvCameras'), { ...payload, createdAt: Date.now() })
  return ref.id
}

export async function deleteCctvCamera(id) {
  await deleteDoc(doc(db, 'cctvCameras', id))
}

export async function listCctvFootageRequests(propertyId) {
  const id = currentPropertyId(propertyId)
  const snap = await getDocs(collection(db, 'cctvFootageRequests'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => (item.propertyId || 'default') === id).sort((a,b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')))
}

export async function saveCctvFootageRequest(propertyId, request) {
  const id = currentPropertyId(propertyId)
  const payload = {
    propertyId: id,
    cameraId: request.cameraId || null,
    requesterName: String(request.requesterName || '').trim(),
    requesterContact: request.requesterContact || '',
    footageDate: request.footageDate || '',
    fromTime: request.fromTime || '',
    toTime: request.toTime || '',
    purpose: request.purpose || '',
    recordCopied: !!request.recordCopied,
    copyFileUrl: request.copyFileUrl || '',
    copyPublicId: request.copyPublicId || '',
    notes: request.notes || '',
    requestedAt: request.requestedAt || new Date().toISOString(),
    updatedAt: Date.now(),
  }
  if (!payload.requesterName || !payload.footageDate) throw new Error('Requester name and footage date are required.')
  if (request.id) {
    await updateDoc(doc(db, 'cctvFootageRequests', request.id), payload)
    return request.id
  }
  const ref = await addDoc(collection(db, 'cctvFootageRequests'), { ...payload, createdAt: Date.now() })
  return ref.id
}

export function warrantyStatus(camera) {
  if (!camera?.purchaseDate) return { label: 'Purchase date not set', daysLeft: null, expired: false }
  const start = new Date(`${camera.purchaseDate}T00:00:00`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + Number(camera.warrantyMonths || 12))
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000)
  return {
    endDate: end.toISOString().slice(0, 10),
    daysLeft,
    expired: daysLeft < 0,
    label: daysLeft < 0 ? `Expired on ${end.toISOString().slice(0, 10)}` : `${daysLeft} days remaining`,
  }
}
