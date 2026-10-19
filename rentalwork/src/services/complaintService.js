import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from 'firebase/firestore'
import { db } from './firebase'

const complaintsRef = collection(db, 'complaints')

// direction: 'tenant_to_owner' | 'owner_to_house'
// For tenant_to_owner: fromHouseId is set, targetHouseIds is null.
// For owner_to_house: targetHouseIds is 'all' or an array of houseIds.

export async function submitTenantComplaint({ fromHouseId, tenantId, message }) {
  await addDoc(complaintsRef, {
    direction: 'tenant_to_owner',
    fromHouseId,
    tenantId,
    targetHouseIds: null,
    message,
    status: 'open', // open | resolved
    createdAt: Date.now(),
    resolvedAt: null,
  })
}

export async function submitOwnerComplaint({ targetHouseIds, message, propertyId }) {
  await addDoc(complaintsRef, {
    direction: 'owner_to_house',
    propertyId: propertyId || 'default',
    fromHouseId: null,
    tenantId: null,
    targetHouseIds, // 'all' or array of houseIds
    message,
    status: 'open',
    createdAt: Date.now(),
    resolvedAt: null,
  })
}

// Owner complaint reads are scoped to the currently accessible houses when houseIds
// are supplied. This avoids downloading complaints belonging only to other
// apartments while preserving legacy/global owner-to-all complaints.
export async function listAllComplaints(houseIds = null, propertyId = null) {
  if (propertyId) {
    const snap = await getDocs(query(complaintsRef, where('propertyId', '==', propertyId)))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }
  if (!Array.isArray(houseIds) || houseIds.length === 0) {
    const snap = await getDocs(query(complaintsRef, orderBy('createdAt', 'desc')))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  const uniqueHouseIds = [...new Set(houseIds.filter(Boolean))]
  const chunks = []
  for (let i = 0; i < uniqueHouseIds.length; i += 30) chunks.push(uniqueHouseIds.slice(i, i + 30))

  const snapshots = await Promise.all([
    getDocs(query(complaintsRef, where('targetHouseIds', '==', 'all'))),
    ...chunks.map((chunk) => getDocs(query(complaintsRef, where('fromHouseId', 'in', chunk)))),
    ...chunks.map((chunk) => getDocs(query(complaintsRef, where('targetHouseIds', 'array-contains-any', chunk)))),
  ])

  const seen = new Map()
  snapshots.forEach((snap) => snap.docs.forEach((d) => seen.set(d.id, { id: d.id, ...d.data() })))
  return Array.from(seen.values()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

// Tenant sees: complaints they filed, plus owner->house complaints addressed to them
// (either explicitly, or broadcast to 'all'). Split into targeted queries so every
// document returned actually satisfies the security rule — a single broad query
// would be rejected since it could include complaints aimed at other houses.
export async function listComplaintsForHouse(houseId) {
  const [mineSnap, allTargetedSnap, houseTargetedSnap] = await Promise.all([
    getDocs(query(complaintsRef, where('fromHouseId', '==', houseId))),
    getDocs(query(complaintsRef, where('direction', '==', 'owner_to_house'), where('targetHouseIds', '==', 'all'))),
    getDocs(query(complaintsRef, where('direction', '==', 'owner_to_house'), where('targetHouseIds', 'array-contains', houseId))),
  ])

  const combined = [...mineSnap.docs, ...allTargetedSnap.docs, ...houseTargetedSnap.docs]
  const seen = new Map()
  combined.forEach((d) => seen.set(d.id, { id: d.id, ...d.data() }))

  return Array.from(seen.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export async function resolveComplaint(complaintId) {
  await updateDoc(doc(db, 'complaints', complaintId), {
    status: 'resolved',
    resolvedAt: Date.now(),
  })
}
