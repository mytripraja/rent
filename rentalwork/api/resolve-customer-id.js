import crypto from 'node:crypto'
import { auth, db, requireAppCheck } from '../lib/firebaseAdmin.js'

const attempts = new Map()
const WINDOW_MS = 60 * 1000
const MAX_ATTEMPTS = 12
const LOGIN_LOCK_MS = 15 * 60 * 1000
const CONSECUTIVE_WINDOW_MS = 15 * 60 * 1000

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
}

function guardKey(identifier, ip) {
  const secret = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 'rental-manager-login-guard'
  return crypto.createHash('sha256').update(`${secret}|${identifier}|${ip}`).digest('hex')
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase().slice(0, 320)
}

async function loginGuard(req, res) {
  const identifier = normalizeIdentifier(req.body?.identifier)
  const mode = String(req.body?.mode || 'status')
  if (!identifier) return res.status(400).json({ error: 'Login identifier is required.' })

  const ip = clientIp(req)
  const ref = db.collection('loginGuards').doc(guardKey(identifier, ip))
  const now = Date.now()

  if (mode === 'reset') {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Unauthenticated' })
    const decoded = await auth.verifyIdToken(token)
    if (decoded.email && normalizeIdentifier(decoded.email) !== identifier) {
      return res.status(403).json({ error: 'Login guard reset is not authorised for this account.' })
    }
    await ref.set({ failedCount: 0, lockedUntil: 0, updatedAt: now }, { merge: true })
    return res.status(200).json({ locked: false, remaining: 3 })
  }

  if (mode === 'failed') {
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref)
      const data = snap.exists ? snap.data() : {}
      const lockedUntil = Number(data.lockedUntil || 0)
      if (lockedUntil > now) {
        return { locked: true, lockedUntil, remaining: 0, failedCount: 3 }
      }

      const previousFailure = Number(data.lastFailureAt || 0)
      const failedCount = previousFailure && now - previousFailure <= CONSECUTIVE_WINDOW_MS
        ? Number(data.failedCount || 0)
        : 0
      const nextCount = Math.min(3, failedCount + 1)
      const nextLockedUntil = nextCount >= 3 ? now + LOGIN_LOCK_MS : 0
      tx.set(ref, {
        failedCount: nextCount,
        lastFailureAt: now,
        lockedUntil: nextLockedUntil,
        updatedAt: now,
      }, { merge: true })
      return { locked: nextCount >= 3, lockedUntil: nextLockedUntil, remaining: Math.max(0, 3 - nextCount), failedCount: nextCount }
    })
    return res.status(200).json(result)
  }

  const snap = await ref.get()
  const data = snap.exists ? snap.data() : {}
  const lockedUntil = Number(data.lockedUntil || 0)
  if (lockedUntil > now) {
    return res.status(200).json({ locked: true, lockedUntil, remaining: 0, failedCount: 3 })
  }
  return res.status(200).json({ locked: false, lockedUntil: 0, remaining: Math.max(0, 3 - Number(data.failedCount || 0)), failedCount: Number(data.failedCount || 0) })
}

// Customer IDs are intentionally resolved server-side so the browser cannot
// enumerate customerLookup/{id} with a Firestore query. The endpoint also hosts
// the server-side login-attempt guard so the app does not need another Vercel function.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    await requireAppCheck(req)
    if (req.body?.action === 'guard') return await loginGuard(req, res)

    const customerId = String(req.body?.customerId || '').trim().toUpperCase()
    const ip = clientIp(req)
    const now = Date.now()
    const recent = (attempts.get(ip) || []).filter(t => now - t < WINDOW_MS)
    if (recent.length >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts. Please try again shortly.' })
    }
    recent.push(now)
    attempts.set(ip, recent)
    if (!/^RM\d{4,12}$/.test(customerId)) {
      return res.status(404).json({ error: 'No account found for that Customer ID.' })
    }

    const snap = await db.collection('customerLookup').doc(customerId).get()
    const email = snap.data()?.email
    if (!email) return res.status(404).json({ error: 'No account found for that Customer ID.' })

    return res.status(200).json({ email })
  } catch (err) {
    console.error('customer/login guard:', err)
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Unable to process the request.' })
  }
}
