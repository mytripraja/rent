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
export const appCheck = admin.appCheck()
export function getBackupBucket() {
  if (!process.env.BACKUP_BUCKET) throw new Error('BACKUP_BUCKET is not configured')
  return admin.storage().bucket(process.env.BACKUP_BUCKET)
}

export async function requireAppCheck(req) {
  if (process.env.FIREBASE_APPCHECK_ENFORCED !== 'true') return null
  const token = req.headers['x-firebase-appcheck']
  if (!token) {
    const err = new Error('App Check required')
    err.statusCode = 401
    throw err
  }
  try { return await appCheck.verifyToken(token) }
  catch {
    const err = new Error('Invalid App Check token')
    err.statusCode = 401
    throw err
  }
}

// Verifies the caller's Firebase ID token (sent as "Authorization: Bearer <token>"
// from the client) and returns their decoded token, or throws.
export async function requireAuth(req) {
  await requireAppCheck(req)
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
export function tenantPermissionEnabled(profile, permission) {
  if (!profile || profile.role !== 'tenant') return false
  const permissions = profile.tenantPermissions || {}
  if (permissions.rent === false && ['rentStatus', 'rentDetails', 'rentSubmit'].includes(permission)) return false
  return permissions[permission] !== false
}

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


export function ownerCanAccessProperty(profile, propertyId) {
  if (!profile || !['owner', 'admin'].includes(profile.role)) return false
  if (profile.role === 'owner' && profile.appMode === 'dad-lite') return false
  if (profile.role === 'admin') return true
  if (!Object.prototype.hasOwnProperty.call(profile, 'propertyAccess')) return true
  const access = Array.isArray(profile.propertyAccess) ? profile.propertyAccess : []
  return access.includes('*') || access.includes(String(propertyId || 'default'))
}

export async function getHouseForOwnerAccess(uid, houseId) {
  const userSnap = await db.collection('users').doc(uid).get()
  const profile = userSnap.exists ? userSnap.data() : null
  const houseSnap = await db.collection('houses').doc(String(houseId || '')).get()
  if (!houseSnap.exists) return { profile, house: null, allowed: false }
  const house = houseSnap.data() || {}
  const propertyId = String(house.propertyId || 'default')
  return { profile, house, propertyId, allowed: ownerCanAccessProperty(profile, propertyId) }
}

export async function requireOwnerLevel(req) {
  const decoded = await requireAuth(req)
  const userDoc = await db.collection('users').doc(decoded.uid).get()
  const profile = userDoc.data() || {}
  const role = profile.role
  if ((role !== 'owner' && role !== 'admin') || (role === 'owner' && profile.appMode === 'dad-lite')) {
    const err = new Error('Owner access required')
    err.statusCode = 403
    throw err
  }
  return decoded
}

export async function requireDadLite(req) {
  const decoded = await requireAuth(req)
  const userDoc = await db.collection('users').doc(decoded.uid).get()
  const profile = userDoc.data() || {}
  if (profile.role !== 'owner' || profile.appMode !== 'dad-lite') {
    const err = new Error('Dad Lite access required')
    err.statusCode = 403
    throw err
  }
  return { decoded, profile }
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
