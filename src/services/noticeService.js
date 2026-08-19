import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from './firebase'

const noticesRef = collection(db, 'notices')

// type: 'water' | 'eb' | 'both' | 'urgent' | 'general' | 'other'
// targetHouseIds: 'all' or an array of houseIds
export async function createNotice({ type, message, windowText, durationHours, targetHouseIds }) {
  const expiresAt = durationHours ? Date.now() + durationHours * 60 * 60 * 1000 : null

  await addDoc(noticesRef, {
    type,
    message,
    windowText: windowText || null,
    targetHouseIds: targetHouseIds || 'all',
    createdAt: Date.now(),
    expiresAt,
  })
}

export async function listActiveNotices() {
  const snap = await getDocs(query(noticesRef, orderBy('createdAt', 'desc')))
  const now = Date.now()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((n) => !n.expiresAt || n.expiresAt > now)
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
