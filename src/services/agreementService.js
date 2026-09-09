import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from './firebase'
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
