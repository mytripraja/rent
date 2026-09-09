// Shared across every function in /api. The Admin SDK works fine on Firebase's
// free Spark plan — Blaze is only required to *deploy Cloud Functions*, not to
// call Firestore/Auth Admin APIs from elsewhere (like a Vercel function). That's
// the whole trick that lets this app avoid Firebase billing entirely.
import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    ),
  })
}

export const auth = admin.auth()
export const db = admin.firestore()

// Verifies the caller's Firebase ID token (sent as "Authorization: Bearer <token>"
// from the client) and returns their decoded token, or throws.
export async function requireAuth(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    const err = new Error('Unauthenticated')
    err.statusCode = 401
    throw err
  }
  return auth.verifyIdToken(token)
}

// Same as requireAuth, but also checks the caller's users/{uid} doc says role: 'owner'.
export async function requireOwner(req) {
  const decoded = await requireAuth(req)
  const userDoc = await db.collection('users').doc(decoded.uid).get()
  if (userDoc.data()?.role !== 'owner') {
    const err = new Error('Owner access required')
    err.statusCode = 403
    throw err
  }
  return decoded
}

// Owner-level (admin OR co-owner) — used for most day-to-day owner actions.
export async function requireOwnerLevel(req) {
  const decoded = await requireAuth(req)
  const userDoc = await db.collection('users').doc(decoded.uid).get()
  const role = userDoc.data()?.role
  if (role !== 'owner' && role !== 'admin') {
    const err = new Error('Owner access required')
    err.statusCode = 403
    throw err
  }
  return decoded
}

// Admin-only (the super-owner) — used for managing other owner accounts.
export async function requireAdmin(req) {
  const decoded = await requireAuth(req)
  const userDoc = await db.collection('users').doc(decoded.uid).get()
  if (userDoc.data()?.role !== 'admin') {
    const err = new Error('Admin access required')
    err.statusCode = 403
    throw err
  }
  return decoded
}
