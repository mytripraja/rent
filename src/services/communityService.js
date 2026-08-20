import { collection, addDoc, getDocs, query, orderBy, limit as fsLimit, deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const messagesRef = collection(db, 'communityMessages')

export async function postMessage({ authorId, authorName, authorRole, houseId, text }) {
  await addDoc(messagesRef, {
    authorId,
    authorName,
    authorRole, // 'owner' | 'tenant'
    houseId: houseId || null,
    text,
    createdAt: Date.now(),
  })
}

export async function listRecentMessages(count = 100) {
  const snap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), fsLimit(count)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()
}

export async function deleteMessage(id) {
  await deleteDoc(doc(db, 'communityMessages', id))
}
