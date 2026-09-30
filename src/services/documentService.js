import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore'
import { db, authedFetch } from './firebase'
import { uploadPrivate, getPrivateViewUrl } from './cloudinaryService'

const documentsRef = collection(db, 'documents')

// docType: 'aadhaar' | 'ration_card'
// Uploaded to Cloudinary as a private 'authenticated' asset — no permanent
// fileUrl is stored, since the whole point is that it can't be viewed without
// a signed, expiring URL minted on demand (see getDocumentViewUrl below).
export async function uploadResidentDocument({ houseId, tenantId, docType, residentName, file, signatureName }) {
  const { publicId, resourceType } = await uploadPrivate(file, `private-documents/${houseId}`)

  await addDoc(documentsRef, {
    houseId,
    tenantId,
    docType,
    residentName,
    publicId,
    resourceType,
    consentSignatureName: signatureName,
    consentAcceptedAt: Date.now(),
    uploadedAt: Date.now(),
  })
}

export async function listDocumentsForHouse(houseId) {
  const snap = await getDocs(query(documentsRef, where('houseId', '==', houseId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0))
}

// Tenant-safe document listing: query only by tenantId so we do not introduce
// a composite index requirement, then confirm the active house locally.
export async function listDocumentsForTenantHouse(houseId, tenantId) {
  if (!houseId || !tenantId) return []
  const snap = await getDocs(query(documentsRef, where('tenantId', '==', tenantId)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.houseId === houseId)
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0))
}

export async function listAllDocuments() {
  const snap = await getDocs(query(documentsRef, orderBy('uploadedAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Owner/admin property-scoped document loading. Firestore 'in' queries are
// limited to 30 values, so split accessible house IDs into safe batches.
export async function listDocumentsForHouses(houseIds = []) {
  const ids = new Set((houseIds || []).filter(Boolean))
  if (!ids.size) return []
  const result = await authedFetch('/api/owner-documents', {})
  return (Array.isArray(result.documents) ? result.documents : [])
    .filter((d) => ids.has(d.houseId))
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0))
}

// Owner-only. The server resolves the document record and checks property access
// before minting a fresh, short-lived signed URL.
export async function getDocumentViewUrl(documentEntry) {
  if (!documentEntry?.id) throw new Error('Document ID is required')
  return getPrivateViewUrl(documentEntry.id)
}

export async function verifyDocument(docId, expiryDate = null) {
  const updateData = {
    verified: true,
    verifiedAt: Date.now(),
    reuploadRequested: false,
    reuploadReason: null
  }
  if (expiryDate) {
    updateData.expiryDate = new Date(expiryDate).getTime()
  }
  await updateDoc(doc(db, 'documents', docId), updateData)
}

export async function requestReupload(docId, reason) {
  await updateDoc(doc(db, 'documents', docId), {
    reuploadRequested: true,
    reuploadReason: reason,
    reuploadRequestedAt: Date.now(),
    verified: false
  })
}

export async function getExpiringDocuments(daysAhead = 30) {
  const snap = await getDocs(query(documentsRef, orderBy('expiryDate')))
  const now = Date.now()
  const cutoff = now + daysAhead * 24 * 60 * 60 * 1000
  
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => d.expiryDate && d.expiryDate > now && d.expiryDate <= cutoff)
}

export async function getExpiringDocumentsForHouses(houseIds = [], daysAhead = 30) {
  const docs = await listDocumentsForHouses(houseIds)
  const now = Date.now()
  const cutoff = now + daysAhead * 24 * 60 * 60 * 1000
  return docs.filter((d) => d.expiryDate && d.expiryDate > now && d.expiryDate <= cutoff)
}
