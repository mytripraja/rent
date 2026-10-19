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

export async function listTodaysVisitors(houseIds = null) {
  const today = new Date().toISOString().split('T')[0]
  if (Array.isArray(houseIds)) {
    if (!houseIds.length) return []
    const chunks = []
    for (let i = 0; i < houseIds.length; i += 30) chunks.push(houseIds.slice(i, i + 30))
    const snaps = await Promise.all(chunks.map(ids => getDocs(query(visitorsRef, where('houseId', 'in', ids)))))
    return snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
      .filter(v => v.expectedDate === today)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }
  const snap = await getDocs(query(visitorsRef, where('expectedDate', '==', today)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function updateVisitorStatus(visitorId, status) {
  await updateDoc(doc(db, 'visitors', visitorId), { status })
}
