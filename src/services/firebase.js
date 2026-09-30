import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

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

// Optional production App Check. Configure VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
// after registering rent.deepusiva.com in Firebase App Check. The feature stays
// disabled until the site key is supplied, so local development is unaffected.
export const appCheck = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
  ? initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  : null

export const auth = getAuth(app)
// Firebase's current persistentLocalCache API replaces the older
// enableMultiTabIndexedDbPersistence() helper. It keeps the app responsive
// when a tenant briefly loses connectivity and supports multiple tabs.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// Used by any client call into /api/* — attaches the current user's Firebase
// ID token so the serverless function can verify who's calling.
export async function getAppCheckHeader() {
  if (!appCheck) return {}
  try {
    const token = await getToken(appCheck)
    return token?.token ? { 'X-Firebase-AppCheck': token.token } : {}
  } catch {
    return {}
  }
}

export async function authedFetch(path, body) {
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null
  const appCheckHeader = await getAppCheckHeader()
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...appCheckHeader,
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
