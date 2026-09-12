import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db, authedFetch } from './firebase'
import { uploadPrivate } from './cloudinaryService'

const agreementsRef = collection(db, 'rentAgreements')

export async function uploadAgreement({ houseId, tenantId, tenantName, startDate, endDate, monthlyRent, file }) {
  const { publicId, resourceType } = await uploadPrivate(file, 'agreements')
  await addDoc(agreementsRef, {
    houseId, tenantId, tenantName, startDate, endDate, monthlyRent,
    publicId, resourceType,
    uploadedAt: Date.now()
  })
}

export async function getAgreementForHouse(houseId) {
  const snap = await getDocs(query(agreementsRef, where('houseId', '==', houseId)))
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.uploadedAt - a.uploadedAt)
  return docs[0] || null
}

export async function listAllAgreements() {
  const snap = await getDocs(query(agreementsRef, orderBy('uploadedAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Owner can view any agreement; a tenant can only view their own house's —
// enforced server-side in api/get-agreement-url.js, not just by the UI
// hiding the button, since a client-side-only check isn't a real guarantee.
export async function getAgreementViewUrl(agreement) {
  const data = await authedFetch('/api/get-agreement-url', {
    agreementId: agreement.id,
    publicId: agreement.publicId,
    resourceType: agreement.resourceType,
  })
  return data.url
}
