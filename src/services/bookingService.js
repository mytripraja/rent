import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const bookingsRef = collection(db, 'areaBookings')

export async function requestBooking({ area, houseId, tenantId, tenantName, date, timeSlot, purpose }) {
  await addDoc(bookingsRef, {
    area, houseId, tenantId, tenantName, date, timeSlot, purpose,
    status: 'pending',
    createdAt: Date.now()
  })
}

export async function listBookings(dateFilter = null, houseId = null) {
  // Avoid a composite date+house index. Query the more security-specific field
  // and apply the second filter/sort locally.
  let q
  if (dateFilter && houseId) q = query(bookingsRef, where('houseId', '==', houseId))
  else if (dateFilter) q = query(bookingsRef, where('date', '==', dateFilter))
  else if (houseId) q = query(bookingsRef, where('houseId', '==', houseId))
  else q = query(bookingsRef, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => !dateFilter || item.date === dateFilter)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

export async function approveBooking(id) {
  await updateDoc(doc(db, 'areaBookings', id), { status: 'approved' })
}

export async function rejectBooking(id, reason) {
  await updateDoc(doc(db, 'areaBookings', id), { status: 'rejected', rejectionReason: reason })
}

export async function getAvailability(area, date) {
  // The area+date combination can require a composite index. Query by area
  // and filter the date in memory instead.
  const snap = await getDocs(query(bookingsRef, where('area', '==', area)))
  return snap.docs.map(d => d.data()).filter(item => item.date === date)
}
