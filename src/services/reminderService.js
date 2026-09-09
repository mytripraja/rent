import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore'
import { db } from './firebase'
import { listHouses } from './houseService'
import { createNotification } from './notificationService'
import { listRentHistory } from './rentService'

export async function checkAndCreateReminders() {
  const houses = await listHouses()
  const occupied = houses.filter(h => h.status === 'occupied')
  
  const today = new Date()
  const monthStr = today.toISOString().slice(0, 7) // 'YYYY-MM'
  
  if (today.getDate() < 1) return [] // Only check on/after 1st (always true but just keeping logic)

  const unpaid = []
  
  for (const house of occupied) {
    // Check if rent payment exists for this month
    const rentHistory = await listRentHistory(house.id)
    const paidForMonth = rentHistory.find(p => p.month === monthStr && p.status !== 'rejected')
    
    if (!paidForMonth) {
      unpaid.push(house)
    }
  }
  return unpaid
}

export async function getReminderStatus(houseId, month) {
  const docRef = doc(db, 'remindersSent', `${houseId}_${month}`)
  const snap = await getDocs(query(collection(db, 'remindersSent'), where('__name__', '==', `${houseId}_${month}`)))
  return !snap.empty
}

export async function markReminderSent(houseId, month) {
  await setDoc(doc(db, 'remindersSent', `${houseId}_${month}`), {
    houseId,
    month,
    sentAt: Date.now()
  })
}

export async function sendReminder(house, month, tenantUid) {
  if (!tenantUid) return false // Need a user to send notification to

  await createNotification({
    recipientId: tenantUid,
    recipientType: 'tenant',
    type: 'payment_reminder',
    title: 'Rent Reminder',
    message: `Your rent for ${month} is due. Please pay at your earliest convenience.`,
    metadata: { month, houseId: house.id }
  })
  
  await markReminderSent(house.id, month)
  return true
}
