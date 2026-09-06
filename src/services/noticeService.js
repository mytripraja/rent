import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  onSnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import { listHouses } from './houseService'
import { createBulkNotifications } from './notificationService'

const noticesRef = collection(db, 'notices')

// type: 'water' | 'eb' | 'both' | 'urgent' | 'general' | 'other'
// targetHouseIds: 'all' or an array of houseIds
export async function createNotice({ type, message, windowText, durationHours, targetHouseIds, createdBy, scheduledAt }) {
  const expiresAt = durationHours ? Date.now() + durationHours * 60 * 60 * 1000 : null

  const noticeRef = await addDoc(noticesRef, {
    type,
    message,
    windowText: windowText || null,
    targetHouseIds: targetHouseIds || 'all',
    createdAt: Date.now(),
    expiresAt,
    scheduledAt: scheduledAt || null,
  })

  // Notify targeted tenants
  const houses = await listHouses()
  const targetedHouses = targetHouseIds === 'all' 
    ? houses 
    : houses.filter(h => targetHouseIds.includes(h.id))
  
  const notifications = targetedHouses
    .filter(h => h.status === 'occupied' && h.tenantId)
    .map(h => ({
      recipientId: h.tenantId,
      recipientType: 'tenant',
      type: 'notice_posted',
      title: 'New Notice Posted',
      message: message.substring(0, 50) + (message.length > 50 ? '...' : '')
    }))
    
  if (notifications.length > 0) {
    await createBulkNotifications(notifications)
  }

  // Task 2: Log activity
  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'created',
    entityType: 'notice',
    entityId: noticeRef.id,
    performedBy: createdBy?.uid || null,
    performedByName: createdBy?.name || 'Owner',
    details: `Posted new ${type} notice`
  })
}

export async function listActiveNotices() {
  const snap = await getDocs(query(noticesRef, orderBy('createdAt', 'desc')))
  const now = Date.now()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((n) => (!n.expiresAt || n.expiresAt > now) && (!n.scheduledAt || n.scheduledAt <= now))
}

export async function listAllNotices() {
  const snap = await getDocs(query(noticesRef, orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function deleteNotice(noticeId) {
  await deleteDoc(doc(db, 'notices', noticeId))
}

export function noticeAppliesTo(notice, houseId) {
  if (notice.targetHouseIds === 'all') return true
  return Array.isArray(notice.targetHouseIds) && notice.targetHouseIds.includes(houseId)
}

export function subscribeToActiveNotices(callback) {
  const q = query(noticesRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const now = Date.now()
    const active = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((n) => (!n.expiresAt || n.expiresAt > now) && (!n.scheduledAt || n.scheduledAt <= now))
    callback(active)
  })
}
