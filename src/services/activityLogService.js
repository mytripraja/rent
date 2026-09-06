import { collection, addDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from './firebase'

const activityLogRef = collection(db, 'activityLog')

export async function logActivity({ action, entityType, entityId, performedBy, performedByName, details }) {
  await addDoc(activityLogRef, {
    action,
    entityType,
    entityId,
    performedBy,
    performedByName,
    details,
    timestamp: Date.now()
  })
}

export async function listActivities(max = 100) {
  const snap = await getDocs(query(activityLogRef, orderBy('timestamp', 'desc'), limit(max)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function listActivitiesForEntity(entityType, entityId) {
  const snap = await getDocs(
    query(
      activityLogRef,
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('timestamp', 'desc')
    )
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
