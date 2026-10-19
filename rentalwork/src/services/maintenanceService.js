import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'
import { uploadPrivate } from './cloudinaryService'

const requestsRef = collection(db, 'maintenanceRequests')

export async function submitRequest({ houseId, tenantId, tenantName, category, description, photoFiles, priority }) {
  const photos = await Promise.all(
    (photoFiles || []).map(file => uploadPrivate(file, `maintenance/${houseId}`))
  )
  await addDoc(requestsRef, {
    houseId, tenantId, tenantName, category, description, photos: photos.map(p => ({ publicId: p.publicId, resourceType: p.resourceType })), priority,
    status: 'open',
    assignedTo: '',
    ownerNotes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    resolvedAt: null
  })
}

export async function listAllRequests(statusFilter = 'all', houseIds = null) {
  // Prefer house-scoped reads for owner screens. This keeps maintenance data
  // inside the currently accessible property instead of downloading every request.
  if (Array.isArray(houseIds)) {
    if (!houseIds.length) return []
    const chunks = []
    for (let i = 0; i < houseIds.length; i += 30) chunks.push(houseIds.slice(i, i + 30))
    const snaps = await Promise.all(chunks.map(ids => getDocs(query(requestsRef, where('houseId', 'in', ids)))))
    let reqs = snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
    if (statusFilter !== 'all') reqs = reqs.filter(r => r.status === statusFilter)
    return reqs.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }
  const snap = await getDocs(query(requestsRef, orderBy('createdAt', 'desc')))
  let reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (statusFilter !== 'all') reqs = reqs.filter(r => r.status === statusFilter)
  return reqs
}

export async function listRequestsForHouse(houseId) {
  const snap = await getDocs(query(requestsRef, where('houseId', '==', houseId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt)
}

export async function updateRequestStatus(requestId, { status, assignedTo, ownerNotes }) {
  await updateDoc(doc(db, 'maintenanceRequests', requestId), {
    status, assignedTo: assignedTo || '', ownerNotes: ownerNotes || '', updatedAt: Date.now()
  })
}

export async function resolveRequest(requestId) {
  await updateDoc(doc(db, 'maintenanceRequests', requestId), {
    status: 'resolved', resolvedAt: Date.now(), updatedAt: Date.now()
  })
}
