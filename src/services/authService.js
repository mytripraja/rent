import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithCredential,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from './firebase'
import { resolveEmailFromCustomerId } from './customerService'

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

// Login by Customer ID: resolve the linked email first (public lookup doc),
// then sign in normally with that email + the password they type.
export async function loginWithCustomerId(customerId, password) {
  const email = await resolveEmailFromCustomerId(customerId.trim().toUpperCase())
  if (!email) {
    throw new Error('No account found for that Customer ID.')
  }
  return login(email, password)
}

function isLikelyInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // Capacitor/WebView-style browsers often block popups; redirect is safer there.
  return /wv|Capacitor|; wv\)/i.test(ua) || (/Android/i.test(ua) && !/Chrome/i.test(ua))
}

// Google sign-in. Uses a popup on normal browsers, falls back to redirect on
// mobile/in-app webviews (relevant since you package some apps with Capacitor).
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  if (isLikelyInAppBrowser()) {
    await signInWithRedirect(auth, provider)
    return null // result is picked up by handleGoogleRedirectResult() on next load
  }

  try {
    const cred = await signInWithPopup(auth, provider)
    return cred.user
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, provider)
      return null
    }
    if (err.code === 'auth/account-exists-with-different-credential') {
      // This Google email already has an email/password account (created by the owner).
      // Ask them to sign in with that password once, then we link Google to it below.
      throw new Error(
        'This email already has a password login. Sign in with your email and password once, then link Google from your profile.'
      )
    }
    throw err
  }
}

// Call once on app load to finish a redirect-based Google sign-in.
export async function handleGoogleRedirectResult() {
  const result = await getRedirectResult(auth)
  return result ? result.user : null
}

// Lets an already-logged-in tenant attach Google as an additional way to sign
// into the same account the owner created for them.
export async function linkGoogleToCurrentAccount() {
  const provider = new GoogleAuthProvider()
  const cred = await signInWithPopup(auth, provider).catch(() => null)
  if (!cred) return
  await linkWithCredential(auth.currentUser, GoogleAuthProvider.credentialFromResult(cred))
}

export async function logout() {
  await signOut(auth)
}

// Owner uses this to create a tenant login when a house is booked.
// Tenant never self-registers.
// Delegates to a Cloud Function (Admin SDK) so creating the account doesn't
// hijack the owner's own signed-in session — the client SDK's
// createUserWithEmailAndPassword would otherwise switch you to the new tenant.
// Also mints (or reuses, if this Aadhaar already has one) a bank-style unique
// Customer ID that stays with the person across every house they ever rent.
export async function createTenantAccount({ email, password, name, houseId, phone, aadhaarNumber }) {
  const call = httpsCallable(functions, 'createTenantAccountAdmin')
  const result = await call({ email, password, name, phone, houseId, aadhaarNumber })
  return result.data // { uid, customerId }
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
