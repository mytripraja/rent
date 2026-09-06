import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'
import { uploadUnsigned } from './cloudinaryService'

const requestsRef = collection(db, 'maintenanceRequests')

export async function submitRequest({ houseId, tenantId, tenantName, category, description, photoFiles, priority }) {
  const photos = await Promise.all(
    (photoFiles || []).map(file => uploadUnsigned(file, 'maintenance'))
  )
  await addDoc(requestsRef, {
    houseId, tenantId, tenantName, category, description, photos, priority,
    status: 'open',
    assignedTo: '',
    ownerNotes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    resolvedAt: null
  })
}

export async function listAllRequests(statusFilter = 'all') {
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
