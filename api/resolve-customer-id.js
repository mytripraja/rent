import { db } from '../lib/firebaseAdmin.js'

const attempts = new Map()
const WINDOW_MS = 60 * 1000
const MAX_ATTEMPTS = 12

// Customer IDs are intentionally resolved server-side so the browser cannot
// enumerate customerLookup/{id} with a Firestore query. The endpoint returns
// only the email needed for Firebase Auth sign-in.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    const customerId = String(req.body?.customerId || '').trim().toUpperCase()
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
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
    return res.status(500).json({ error: 'Unable to process Customer ID login.' })
  }
}
