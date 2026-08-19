import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
} from 'firebase/firestore'
import { db } from './firebase'

// customers/{customerId}          -> full profile (owner + the customer themself can read)
// customerLookup/{customerId}     -> { email } only, publicly readable so "login with
//                                     Customer ID" can resolve an email BEFORE the user
//                                     is authenticated (Firebase Auth needs an email to
//                                     sign in with). No other field is exposed here.
//
// One customer can be linked to multiple houseIds over time (like a bank customer ID
// covering multiple accounts) — matched first by Aadhaar number if provided, so the
// same person renting a second house doesn't get a second ID.

const COUNTER_DOC = doc(db, 'counters', 'customerId')

async function nextCustomerNumber() {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(COUNTER_DOC)
    const current = snap.exists() ? snap.data().value : 1000
    const next = current + 1
    tx.set(COUNTER_DOC, { value: next }, { merge: true })
    return next
  })
}

function formatCustomerId(n) {
  return `RM${n}`
}

export async function findCustomerByAadhaar(aadhaarNumber) {
  if (!aadhaarNumber) return null
  const snap = await getDocs(
    query(collection(db, 'customers'), where('aadhaarNumber', '==', aadhaarNumber))
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

// Call this whenever the owner creates a tenant account (booking a house).
// If the same Aadhaar number already has a customer ID, that house gets linked
// to the existing ID instead of minting a new one.
export async function findOrCreateCustomer({ uid, name, email, phone, aadhaarNumber, houseId }) {
  const existing = await findCustomerByAadhaar(aadhaarNumber)

  if (existing) {
    await updateDoc(doc(db, 'customers', existing.id), {
      linkedUids: arrayUnion(uid),
      linkedHouseIds: arrayUnion(houseId),
    })
    return existing.id
  }

  const number = await nextCustomerNumber()
  const customerId = formatCustomerId(number)

  await setDoc(doc(db, 'customers', customerId), {
    customerId,
    name,
    phone,
    email,
    aadhaarNumber: aadhaarNumber || null,
    linkedUids: [uid],
    linkedHouseIds: [houseId],
    createdAt: Date.now(),
  })

  // Minimal public-read doc so "login with Customer ID" can resolve an email pre-auth.
  await setDoc(doc(db, 'customerLookup', customerId), { email })

  return customerId
}

export async function getCustomer(customerId) {
  const snap = await getDoc(doc(db, 'customers', customerId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Used by the Customer-ID login form, before the user is authenticated.
export async function resolveEmailFromCustomerId(customerId) {
  const snap = await getDoc(doc(db, 'customerLookup', customerId))
  if (!snap.exists()) return null
  return snap.data().email
}
