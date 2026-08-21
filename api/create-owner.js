import { auth, db, requireAdmin } from '../lib/firebaseAdmin.js'

// Admin-only: adds a co-owner account (dad, brother, mom, etc). Co-owners get
// the same day-to-day access as the admin except managing other owner accounts.
// Runs server-side via Admin SDK for the same reason create-tenant.js does —
// creating a Firebase Auth user client-side would hijack the caller's own session.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const decoded = await requireAdmin(req)
    const callerDoc = await db.collection('users').doc(decoded.uid).get()
    const createdBy = { uid: decoded.uid, name: callerDoc.data()?.name || 'Admin' }

    const { email, password, name, phone } = req.body || {}
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const userRecord = await auth.createUser({ email, password, displayName: name })

    await db.collection('users').doc(userRecord.uid).set({
      role: 'owner',
      name,
      email,
      phone: phone || null,
      profilePhotoUrl: null,
      createdAt: Date.now(),
      createdBy,
    })

    res.status(200).json({ uid: userRecord.uid })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
