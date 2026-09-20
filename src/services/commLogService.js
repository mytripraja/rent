import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

const commLogsRef = collection(db, 'communicationLogs')

export async function addCommLog({ houseId, tenantName, type, summary, loggedBy, loggedByName, date }) {
  await addDoc(commLogsRef, {
    houseId,
    tenantName,
    type, // 'call' | 'whatsapp' | 'in_person' | 'sms'
    summary,
    loggedBy,
    loggedByName,
    date, // YYYY-MM-DD string
    createdAt: Date.now()
  })
}

export async function listCommLogs(houseId) {
  const snap = await getDocs(
    query(commLogsRef, where('houseId', '==', houseId), orderBy('date', 'desc'), orderBy('createdAt', 'desc'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deleteCommLog(id) {
  await deleteDoc(doc(db, 'communicationLogs', id))
}
