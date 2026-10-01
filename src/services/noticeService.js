import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  onSnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import { listHouses } from './houseService'
import { createBulkNotifications } from './notificationService'
import { uploadSigned } from './cloudinaryService'

const noticesRef = collection(db, 'notices')

function chunkIds(ids, size = 30) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  const chunks = []
  for (let i = 0; i < unique.length; i += size) chunks.push(unique.slice(i, i + size))
  return chunks
}

async function loadNoticesForHouseIds(houseIds, propertyId = null) {
  const ids = [...new Set((houseIds || []).filter(Boolean))]
  const queries = propertyId
    ? [getDocs(query(noticesRef, where('propertyId', '==', propertyId)))]
    : [getDocs(query(noticesRef, where('targetHouseIds', '==', 'all')))]
  if (!propertyId) {
    for (const chunk of chunkIds(ids)) {
      queries.push(getDocs(query(noticesRef, where('targetHouseIds', 'array-contains-any', chunk))))
    }
  }
  const snaps = await Promise.all(queries)
  const seen = new Set()
  return snaps.flatMap((snap) => snap.docs)
    .filter((d) => { if (seen.has(d.id)) return false; seen.add(d.id); return true })
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

// type: 'water' | 'eb' | 'both' | 'urgent' | 'general' | 'other'
// targetHouseIds: 'all' or an array of houseIds
export async function createNotice({
  type,
  title,
  message,
  windowText,
  durationHours,
  targetHouseIds,
  createdBy,
  scheduledAt,
  category,
  happenedAt,
  expectedResolutionAt,
  resolvedAt,
  showTimeDetails = true,
  reason,
  additionalDetails,
  imageFile,
  propertyId,
  parentNoticeId = null,
  updateNumber = null,
  continuationLabel = null,
  notificationHouses = null,
  titleTamil,
  messageTamil,
  categoryTamil,
  reasonTamil,
  additionalDetailsTamil,
}) {
  const expiresAt = durationHours ? Date.now() + durationHours * 60 * 60 * 1000 : null
  const happenedMs = happenedAt ? Number(happenedAt) : null
  const expectedMs = expectedResolutionAt ? Number(expectedResolutionAt) : null
  const resolvedMs = resolvedAt ? Number(resolvedAt) : null
  if (happenedMs && expectedMs && expectedMs < happenedMs) throw new Error('Expected resolution cannot be before Started / happened.')
  if (happenedMs && resolvedMs && resolvedMs < happenedMs) throw new Error('Resolved at cannot be before Started / happened.')
  const publicToken = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}${Math.random().toString(36).slice(2)}`

  const noticeRef = await addDoc(noticesRef, {
    type,
    propertyId: propertyId || 'default',
    title: title || null,
    titleTamil: titleTamil || null,
    message,
    messageTamil: messageTamil || null,
    windowText: windowText || null,
    targetHouseIds: targetHouseIds || 'all',
    createdAt: Date.now(),
    expiresAt,
    scheduledAt: scheduledAt || null,
    category: category || null,
    categoryTamil: categoryTamil || null,
    happenedAt: happenedAt || null,
    expectedResolutionAt: expectedResolutionAt || null,
    resolvedAt: resolvedAt || null,
    showTimeDetails: showTimeDetails !== false,
    status: resolvedAt ? 'resolved' : 'active',
    reason: reason || null,
    reasonTamil: reasonTamil || null,
    additionalDetails: additionalDetails || null,
    additionalDetailsTamil: additionalDetailsTamil || null,
    publicShareEnabled: true,
    publicToken,
    imageUrl: null,
    parentNoticeId: parentNoticeId || null,
    updateNumber: Number(updateNumber || 0) || null,
    continuationLabel: continuationLabel || null,
  })

  let imageUrl = null
  if (imageFile) {
    const uploaded = await uploadSigned(imageFile, `public-notices/${noticeRef.id}`, { visibility: 'upload' })
    imageUrl = uploaded.url
    await updateDoc(noticeRef, { imageUrl })
  }

  const shareUrl = `${window.location.origin}/notice/${noticeRef.id}?token=${encodeURIComponent(publicToken)}`
  const houses = notificationHouses || await listHouses()
  const targetedHouses = targetHouseIds === 'all'
    ? houses
    : houses.filter(h => targetHouseIds.includes(h.id))
  const notifications = targetedHouses
    .filter(h => h.status === 'occupied' && h.tenantId)
    .map(h => ({
      recipientId: h.tenantId,
      recipientType: 'tenant',
      type: 'notice_posted',
      title: title || 'New Notice Posted',
      message: message.substring(0, 80) + (message.length > 80 ? '...' : ''),
      link: shareUrl,
    }))
  if (notifications.length > 0) await createBulkNotifications(notifications)

  const { logActivity } = await import('./activityLogService')
  await logActivity({
    action: 'created',
    entityType: 'notice',
    entityId: noticeRef.id,
    performedBy: createdBy?.uid || null,
    performedByName: createdBy?.name || 'Owner',
    details: `Posted new ${type} notice${targetHouseIds === 'all' ? ' for all houses' : ` for ${targetHouseIds.length} house(s)`}`,
    propertyId: propertyId || 'default'
  })

  return { id: noticeRef.id, publicToken, imageUrl, shareUrl, updateNumber: Number(updateNumber || 0) || null, continuationLabel: continuationLabel || null }
}

export async function ensureNoticePublicShare(noticeId) {
  const ref = doc(db, 'notices', noticeId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Notice not found')
  const data = snap.data() || {}
  if (data.publicToken && data.publicShareEnabled !== false) {
    return { ...data, id: noticeId, publicToken: data.publicToken, shareUrl: `${window.location.origin}/notice/${noticeId}?token=${encodeURIComponent(data.publicToken)}` }
  }
  const publicToken = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`
  await updateDoc(ref, { publicShareEnabled: true, publicToken })
  return { ...data, id: noticeId, publicToken, shareUrl: `${window.location.origin}/notice/${noticeId}?token=${encodeURIComponent(publicToken)}` }
}

export async function listActiveNotices() {
  const snap = await getDocs(query(noticesRef, orderBy('createdAt', 'desc')))
  return filterActiveNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
}

export async function listActiveNoticesForHouses(houseIds) {
  return filterActiveNotices(await loadNoticesForHouseIds(houseIds))
}

export async function listAllNotices() {
  const snap = await getDocs(query(noticesRef, orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function listAllNoticesForHouses(houseIds, propertyId = null) {
  return loadNoticesForHouseIds(houseIds, propertyId)
}

function filterActiveNotices(notices) {
  const now = Date.now()
  return notices.filter((n) => (!n.expiresAt || n.expiresAt > now) && (!n.scheduledAt || n.scheduledAt <= now))
}

export function noticeAppliesTo(notice, houseId) {
  if (notice.targetHouseIds === 'all') return true
  return Array.isArray(notice.targetHouseIds) && notice.targetHouseIds.includes(houseId)
}

export function subscribeToActiveNotices(callback, houseId) {
  if (!houseId) return () => {}
  const allQuery = query(noticesRef, where('targetHouseIds', '==', 'all'))
  const targetedQuery = query(noticesRef, where('targetHouseIds', 'array-contains', houseId))
  let allDocs = []
  let targetedDocs = []
  let allReady = false
  let targetedReady = false

  const emit = () => {
    if (!allReady || !targetedReady) return
    const seen = new Set()
    const notices = [...allDocs, ...targetedDocs]
      .filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true })
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    callback(filterActiveNotices(notices))
  }

  const unsubAll = onSnapshot(allQuery, (snap) => {
    allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    allReady = true
    emit()
  })
  const unsubTargeted = onSnapshot(targetedQuery, (snap) => {
    targetedDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    targetedReady = true
    emit()
  })
  return () => { unsubAll(); unsubTargeted() }
}

export async function deleteNotice(noticeId) {
  await deleteDoc(doc(db, 'notices', noticeId))
}


export async function linkNotices(noticeId, linkedNoticeIds) {
  return (await import('./firebase')).authedFetch('/api/rental?route=link-notices', { noticeId, linkedNoticeIds: [...new Set((linkedNoticeIds || []).filter(id => id && id !== noticeId))] })
}
