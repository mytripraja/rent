import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

export const ENTERPRISE_COLLECTIONS = [
  'accountingTransactions',
  'maintenanceWorkOrders',
  'preventiveMaintenance',
  'purchaseOrders',
  'inventoryItems',
  'securityEvents',
  'parcels',
  'leaseRecords',
  'utilityBills',
  'ownerInvestments',
  'communicationMessages',
  'societyHierarchy',
  'backupPlans',
  'apiIntegrations',
  'documentRegistry',
]

export async function listRecords(collectionName, propertyId = null) {
  const base = collection(db, collectionName)
  if (collectionName === 'activityLog') {
    const snap = await getDocs(query(base, orderBy('timestamp', 'desc')))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  const q = propertyId ? query(base, where('propertyId', '==', propertyId)) : query(base, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

export async function listRecordsByField(collectionName, field, value) {
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

export async function createRecord(collectionName, data) {
  if (collectionName !== 'activityLog' && !data.propertyId) throw new Error('propertyId is required for operational records')
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: data.createdAt || Date.now(),
    updatedAt: Date.now(),
  })
  return { id: ref.id, ...data, createdAt: data.createdAt || Date.now(), updatedAt: Date.now() }
}

export async function updateRecord(collectionName, id, data) {
  await updateDoc(doc(db, collectionName, id), { ...data, updatedAt: Date.now() })
}

export async function deleteRecord(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id))
}

export async function exportCollections(collectionNames, propertyId = null) {
  const result = {}
  for (const name of collectionNames) {
    result[name] = await listRecords(name, name === 'activityLog' ? null : propertyId)
  }
  return result
}

// True double-entry journal: every transaction creates equal debit and credit lines.
export async function createAccountingJournal({ propertyId, createdBy, date, description, amount, debitAccount, creditAccount, category = 'General', houseId = null }) {
  const value = Number(amount)
  if (!propertyId) throw new Error('propertyId is required')
  if (!Number.isFinite(value) || value <= 0) throw new Error('Amount must be greater than zero')
  if (!debitAccount || !creditAccount || debitAccount === creditAccount) throw new Error('Choose different debit and credit accounts')
  const journalId = `J-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const batch = writeBatch(db)
  const base = { propertyId, createdBy: createdBy || null, journalId, date: date || new Date().toISOString().slice(0,10), description: description || '', category, houseId: houseId || null, entryType: 'journal-line', amount: value, createdAt: Date.now(), updatedAt: Date.now() }
  const debitRef = doc(collection(db, 'accountingTransactions'))
  const creditRef = doc(collection(db, 'accountingTransactions'))
  batch.set(debitRef, { ...base, account: debitAccount, debit: value, credit: 0 })
  batch.set(creditRef, { ...base, account: creditAccount, debit: 0, credit: value })
  await batch.commit()
  return { journalId, debitId: debitRef.id, creditId: creditRef.id }
}
