import { auth, db, requireAdmin } from '../lib/firebaseAdmin.js'

// Admin-only: removes a co-owner's access entirely (Auth account + Firestore doc).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const decoded = await requireAdmin(req)
    const { uid } = req.body || {}
    if (!uid) return res.status(400).json({ error: 'Missing uid' })
    if (uid === decoded.uid) {
      return res.status(400).json({ error: "You can't delete your own admin account." })
    }

    const targetDoc = await db.collection('users').doc(uid).get()
    if (targetDoc.data()?.role !== 'owner') {
      return res.status(400).json({ error: 'Target is not a co-owner account.' })
    }

    await auth.deleteUser(uid).catch(() => {}) // already-deleted Auth user shouldn't block cleanup
    await db.collection('users').doc(uid).delete()

    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
