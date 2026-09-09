import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore'

// Paste your Firebase project config here (from Firebase console > Project settings).
// On Vercel, prefix each value with VITE_ and read via import.meta.env, e.g.
// apiKey: import.meta.env.VITE_FIREBASE_API_KEY
//
// Note: Firebase Storage is intentionally NOT used here. All file uploads
// (rent proofs, EB proofs, Aadhaar/ration card) go through Cloudinary instead
// — see cloudinaryService.js. Firebase Cloud Functions are ALSO not used —
// see /api for the Vercel serverless functions that replace them, which is
// what lets this whole app stay on Firebase's free Spark plan (no Blaze,
// no credit card).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

enableMultiTabIndexedDbPersistence(db).catch((err) => {
  console.warn('Offline persistence failed:', err)
})

// Used by any client call into /api/* — attaches the current user's Firebase
// ID token so the serverless function can verify who's calling.
export async function authedFetch(path, body) {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
