import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
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
  const snap = await getDocs(query(documentsRef, where('houseId', '==', houseId), orderBy('uploadedAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function listAllDocuments() {
  const snap = await getDocs(query(documentsRef, orderBy('uploadedAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Owner-only. Mints a fresh signed URL each time it's called rather than
// reusing a stored link, so access can't be replayed indefinitely.
export async function getDocumentViewUrl(documentEntry) {
  return getPrivateViewUrl(documentEntry.publicId, documentEntry.resourceType)
}

export async function verifyDocument(docId) {
  await updateDoc(doc(db, 'documents', docId), {
    verified: true,
    verifiedAt: Date.now(),
    reuploadRequested: false,
    reuploadReason: null
  })
}

export async function requestReupload(docId, reason) {
  await updateDoc(doc(db, 'documents', docId), {
    reuploadRequested: true,
    reuploadReason: reason,
    reuploadRequestedAt: Date.now(),
    verified: false
  })
}
