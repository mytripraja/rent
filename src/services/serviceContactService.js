import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const contactsRef = collection(db, 'serviceContacts')

// category: 'eb_staff' | 'eb_office' | 'technician' | 'mechanic' | 'puncture_shop' | 'electrician' | 'other'
export async function addServiceContact({ category, label, phone, mapsUrl }) {
  await addDoc(contactsRef, {
    category,
    label,
    phone: phone || null,
    mapsUrl: mapsUrl || null,
    createdAt: Date.now(),
  })
}

export async function listServiceContacts() {
  const snap = await getDocs(query(contactsRef, orderBy('category')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function deleteServiceContact(id) {
  await deleteDoc(doc(db, 'serviceContacts', id))
}
