import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

// Paste your Firebase project config here (from Firebase console > Project settings).
// On Vercel, prefix each value with VITE_ and read via import.meta.env, e.g.
// apiKey: import.meta.env.VITE_FIREBASE_API_KEY
//
// Note: Firebase Storage is intentionally NOT used here. All file uploads
// (rent proofs, EB proofs, Aadhaar/ration card) go through Cloudinary instead
// — see cloudinaryService.js. Firebase is still used for Auth, Firestore, and
// Cloud Functions (the functions are what let signed/private Cloudinary
// uploads happen without exposing your Cloudinary API secret in the browser).
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
export const functions = getFunctions(app)
