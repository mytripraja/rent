import { collection, addDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from './firebase'

const activityLogRef = collection(db, 'activityLog')

export async function logActivity({ action, entityType, entityId, performedBy, performedByName, details, propertyId }) {
  await addDoc(activityLogRef, {
    action,
    entityType,
    entityId,
    performedBy,
    performedByName,
    details,
    propertyId: propertyId || 'default',
    timestamp: Date.now()
  })
}

export async function listActivities(max = 100, propertyId = null) {
  // A property filter + timestamp orderBy requires a composite Firestore index.
  // Keep the activity feed index-free by filtering server-side, then sorting
  // the already-scoped result locally.
  if (propertyId) {
    const snap = await getDocs(query(activityLogRef, where('propertyId', '==', propertyId)))
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
      .slice(0, max)
  }

  const snap = await getDocs(query(activityLogRef, orderBy('timestamp', 'desc'), limit(max)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function listActivitiesForEntity(entityType, entityId, propertyId = null) {
  // Filter by the entity fields in Firestore and sort locally. This avoids a
  // three-field composite index dependency for a detail/history view.
  const snap = await getDocs(
    query(
      activityLogRef,
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      ...(propertyId ? [where('propertyId', '==', propertyId)] : [])
    )
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
}
