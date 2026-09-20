import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

const listingsRef = collection(db, 'wifiShares')
const interestsRef = collection(db, 'wifiShareInterests')

export async function listWifiShares() {
  const snap = await getDocs(query(listingsRef, where('status','==','active')))
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => (a.houseLabel||'').localeCompare(b.houseLabel||''))
}
export async function listMyWifiShares(uid) {
  if (!uid) return []
  const snap = await getDocs(query(listingsRef, where('ownerUid','==',uid)))
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => (b.createdAt||0)-(a.createdAt||0))
}
export async function createWifiShare(data) {
  const ref = await addDoc(listingsRef, { ...data, status:'active', createdAt:Date.now(), updatedAt:Date.now() })
  return ref.id
}
export async function updateWifiShare(id, data) { await updateDoc(doc(db,'wifiShares',id), { ...data, updatedAt:Date.now() }) }
export async function deleteWifiShare(id) { await deleteDoc(doc(db,'wifiShares',id)) }
export async function listWifiInterests(uid) {
  const snap = await getDocs(query(interestsRef, where('ownerUid','==',uid), orderBy('createdAt','desc')))
  return snap.docs.map(d => ({ id:d.id, ...d.data() }))
}
export async function createWifiInterest(data) {
  const ref = await addDoc(interestsRef, { ...data, status:'new', createdAt:Date.now() }); return ref.id
}
export async function updateWifiInterest(id, status) { await updateDoc(doc(db,'wifiShareInterests',id), { status, updatedAt:Date.now() }) }
