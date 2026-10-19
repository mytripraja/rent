import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from './firebase'

const ledgerRef = collection(db, 'advanceLedger')

// mode: 'cash' | 'upi' | 'bank'
export async function addAdvancePayment({ houseId, tenantId, amount, date, mode, note, recordedBy }) {
  await addDoc(ledgerRef, {
    houseId,
    tenantId,
    amount,
    date,
    mode,
    note: note || null,
    recordedBy: recordedBy || null,
    createdAt: Date.now(),
  })
}

export async function listAdvanceLedger(houseId) {
  const snap = await getDocs(query(ledgerRef, where('houseId', '==', houseId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

export async function getAdvanceCollected(houseId) {
  const entries = await listAdvanceLedger(houseId)
  return entries.reduce((sum, e) => sum + Number(e.amount || 0), 0)
}
