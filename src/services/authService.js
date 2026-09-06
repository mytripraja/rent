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
  sendPasswordResetEmail,
  PhoneAuthProvider,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db, authedFetch } from './firebase'
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
// Delegates to a Vercel serverless function (Admin SDK) so creating the
// account doesn't hijack the owner's own signed-in session — the client
// SDK's createUserWithEmailAndPassword would otherwise switch you to the
// new tenant. Also mints (or reuses, if this Aadhaar already has one) a
// bank-style unique Customer ID that stays with the person across every
// house they ever rent.
export async function createTenantAccount({ email, password, name, houseId, phone, aadhaarNumber }) {
  return authedFetch('/api/create-tenant', { email, password, name, houseId, phone, aadhaarNumber })
  // returns { uid, customerId }
}

// ---- Bootstrap only ----
// Creates the very first account (you, the super-admin) before anyone else
// exists to grant access via the admin API. Run this once (e.g. from the
// browser console on the login page) when setting up a brand-new project.
// Every owner added after this should go through createOwnerAccountAdmin()
// instead, which goes through you (the admin) rather than self-registering.
export async function createOwnerAccount({ email, password, name }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'admin',
    name,
    email,
    profilePhotoUrl: null,
    createdAt: Date.now(),
  })
  return cred.user
}

// ---- Multi-owner management (admin only) ----
// Adds a co-owner (dad, brother, mom, etc). They get the same day-to-day
// access as you except managing other owner accounts. Runs server-side so
// creating their login doesn't hijack your own session.
export async function createOwnerAccountAdmin({ email, password, name, phone }) {
  return authedFetch('/api/create-owner', { email, password, name, phone })
}

export async function deleteOwnerAccount(uid) {
  return authedFetch('/api/delete-owner', { uid })
}

export async function listOwners() {
  const snap = await getDocs(
    query(collection(db, 'users'), where('role', 'in', ['owner', 'admin']))
  )
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}

// ---- Profile self-editing ----
// Anyone (owner-level or tenant) can update their own name/phone/photo directly
// — the Firestore rule only allows those three fields to be self-edited, never role/houseId.
export async function updateOwnProfile({ uid, name, phone, profilePhotoUrl }) {
  const updates = {}
  if (name !== undefined) updates.name = name
  if (phone !== undefined) updates.phone = phone
  if (profilePhotoUrl !== undefined) updates.profilePhotoUrl = profilePhotoUrl
  await updateDoc(doc(db, 'users', uid), updates)
}

// ---- Editing a tenant's contact info (owner-level) ----
// Email changes have to go through the Admin SDK (a client can't change
// another user's Firebase Auth email), so this hits /api rather than
// writing Firestore directly.
export async function updateTenantContact({ tenantUid, houseId, newEmail, newPhone }) {
  return authedFetch('/api/update-tenant-contact', { tenantUid, houseId, newEmail, newPhone })
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

export async function verifyPhoneNumber(phoneNumber, recaptchaVerifier) {
  const provider = new PhoneAuthProvider(auth)
  const verificationId = await provider.verifyPhoneNumber(phoneNumber, recaptchaVerifier)
  return verificationId
}

export async function confirmOTP(verificationId, otp) {
  const credential = PhoneAuthProvider.credential(verificationId, otp)
  await linkWithCredential(auth.currentUser, credential)
}
