import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

export async function addNote(houseId, { text, createdBy, createdByName }) {
  await addDoc(collection(db, 'houses', houseId, 'notes'), {
    text,
    createdBy,
    createdByName,
    createdAt: Date.now()
  })
}

export async function listNotes(houseId) {
  const snap = await getDocs(query(collection(db, 'houses', houseId, 'notes'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deleteNote(houseId, noteId) {
  await deleteDoc(doc(db, 'houses', houseId, 'notes', noteId))
}
