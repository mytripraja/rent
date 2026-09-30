import { collection, addDoc, getDocs, query, orderBy, limit as fsLimit, where, doc, updateDoc, writeBatch, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

const notificationsRef = collection(db, 'notifications')

export async function createNotification({ recipientId, recipientType, type, title, message, metadata = {} }) {
  await addDoc(notificationsRef, {
    recipientId,
    recipientType,
    type,
    title,
    message,
    read: false,
    createdAt: Date.now(),
    metadata
  })
}

export async function createBulkNotifications(notifications) {
  if (!notifications || notifications.length === 0) return;
  const batch = writeBatch(db);
  notifications.forEach(notif => {
    const docRef = doc(notificationsRef); // auto ID
    batch.set(docRef, {
      ...notif,
      read: false,
      createdAt: Date.now()
    });
  });
  await batch.commit();
}

export async function listNotifications(userId, limitCount = 50) {
  const q = query(notificationsRef, where('recipientId', '==', userId), fsLimit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function getUnreadCount(userId) {
  // Keep this query single-field so unread-count retrieval does not require a
  // recipientId+read composite index.
  const q = query(notificationsRef, where('recipientId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.reduce((count, d) => count + (d.data().read === false ? 1 : 0), 0);
}

export async function markAsRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true
  });
}

export async function markAllAsRead(userId) {
  // Query by recipient only and filter unread notifications locally to avoid a
  // composite-index requirement.
  const q = query(notificationsRef, where('recipientId', '==', userId));
  const snap = await getDocs(q);
  const unreadDocs = snap.docs.filter(d => d.data().read === false);
  if (unreadDocs.length === 0) return;
  
  const batch = writeBatch(db);
  unreadDocs.forEach(d => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

export function subscribeToNotifications(userId, callback, limitCount = 50) {
  const q = query(notificationsRef, where('recipientId', '==', userId), fsLimit(limitCount));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    callback(notifs);
  });
}
