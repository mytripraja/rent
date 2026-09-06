import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const bookingsRef = collection(db, 'areaBookings')

export async function requestBooking({ area, houseId, tenantName, date, timeSlot, purpose }) {
  await addDoc(bookingsRef, {
    area, houseId, tenantName, date, timeSlot, purpose,
    status: 'pending',
    createdAt: Date.now()
  })
}

export async function listBookings(dateFilter = null) {
  let q = query(bookingsRef, orderBy('createdAt', 'desc'))
  if (dateFilter) {
    q = query(bookingsRef, where('date', '==', dateFilter))
  }
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function approveBooking(id) {
  await updateDoc(doc(db, 'areaBookings', id), { status: 'approved' })
}

export async function rejectBooking(id, reason) {
  await updateDoc(doc(db, 'areaBookings', id), { status: 'rejected', rejectionReason: reason })
}

export async function getAvailability(area, date) {
  const snap = await getDocs(query(bookingsRef, where('area', '==', area), where('date', '==', date)))
  return snap.docs.map(d => d.data())
}
