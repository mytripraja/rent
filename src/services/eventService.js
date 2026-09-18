import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const eventsRef = collection(db, 'events')

export async function createEvent({ title, description, date, time, type }) {
  await addDoc(eventsRef, {
    title, description, date, time, type,
    createdAt: Date.now()
  })
}

export async function listUpcomingEvents() {
  const today = new Date().toISOString().split('T')[0]
  const snap = await getDocs(query(eventsRef, where('date', '>=', today)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date))
}

export async function listEventsForMonth(month) {
  const snap = await getDocs(query(eventsRef, where('date', '>=', `${month}-01`), where('date', '<=', `${month}-31`)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deleteEvent(id) {
  await deleteDoc(doc(db, 'events', id))
}
