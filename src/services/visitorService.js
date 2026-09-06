import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const visitorsRef = collection(db, 'visitors')

export async function registerVisitor({ houseId, tenantId, visitorName, purpose, expectedDate, expectedTime, vehicleNumber, notes }) {
  await addDoc(visitorsRef, {
    houseId, tenantId, visitorName, purpose, expectedDate, expectedTime, vehicleNumber, notes,
    status: 'expected',
    createdAt: Date.now()
  })
}

export async function listVisitorsForHouse(houseId) {
  const snap = await getDocs(query(visitorsRef, where('houseId', '==', houseId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt)
}

export async function listTodaysVisitors() {
  const today = new Date().toISOString().split('T')[0]
  const snap = await getDocs(query(visitorsRef, where('expectedDate', '==', today)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function updateVisitorStatus(visitorId, status) {
  await updateDoc(doc(db, 'visitors', visitorId), { status })
}
