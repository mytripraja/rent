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
  const q = query(
    notificationsRef,
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUnreadCount(userId) {
  const q = query(
    notificationsRef,
    where('recipientId', '==', userId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  return snap.docs.length;
}

export async function markAsRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true
  });
}

export async function markAllAsRead(userId) {
  const q = query(
    notificationsRef,
    where('recipientId', '==', userId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

export function subscribeToNotifications(userId, callback, limitCount = 50) {
  const q = query(
    notificationsRef,
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc'),
    fsLimit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(notifs);
  });
}
