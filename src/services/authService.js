import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

// users/{uid} => { role: 'owner' | 'tenant', houseId?: string, name, email }

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null)
      return
    }
    const profile = await getUserProfile(firebaseUser.uid)
    callback({ uid: firebaseUser.uid, email: firebaseUser.email, ...profile })
  })
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function logout() {
  await signOut(auth)
}

// Owner uses this to create a tenant login when a house is booked.
// Tenant never self-registers.
export async function createTenantAccount({ email, password, name, houseId, phone }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'tenant',
    name,
    email,
    phone,
    houseId,
    createdAt: Date.now(),
  })
  return cred.user
}

export async function createOwnerAccount({ email, password, name }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'owner',
    name,
    email,
    createdAt: Date.now(),
  })
  return cred.user
}
