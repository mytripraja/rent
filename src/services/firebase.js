import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
// NOTE: `firebase/app-check` is deliberately NOT imported statically. It is only
// needed by authenticated calls into /api/*, so it is loaded on demand in
// getAppCheckHeader() below — that keeps the reCAPTCHA Enterprise SDK out of the
// initial parse entirely (and out of the bundle's graph when the site key is
// unset, i.e. every local/dev build).

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
// `appCheck` keeps its original name and stays null until the SDK has actually
// been initialised (i.e. still null whenever no site key is configured).
export let appCheck = null

let appCheckModulePromise = null
let appCheckToken = null

function ensureAppCheck() {
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
  if (!siteKey) return Promise.resolve(null)

  if (!appCheckModulePromise) {
    appCheckModulePromise = import('firebase/app-check')
      .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider, getToken }) => {
        appCheckToken = getToken
        appCheck = initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true,
        })
        return appCheck
      })
      .catch((error) => {
        console.error('Failed to initialise Firebase App Check', error)
        appCheckModulePromise = null // retry on the next call
        return null
      })
  }

  return appCheckModulePromise
}

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
  const instance = await ensureAppCheck()
  if (!instance || !appCheckToken) return {}
  try {
    const token = await appCheckToken(instance)
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
