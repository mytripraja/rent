import { auth, db, requireAuth, ownerCanAccessProperty } from '../lib/firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'

async function profile(uid) {
  const snap = await db.collection('users').doc(uid).get()
  return snap.exists ? snap.data() : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const decoded = await requireAuth(req)
    const caller = await profile(decoded.uid)
    const { uid } = req.body || {}
    const target = await profile(uid)
    if (!target || target.role !== 'tenant' || target.accountType !== 'sub') return res.status(404).json({ error: 'Family account not found' })
    let allowed = caller?.role === 'admin' || (caller?.role === 'owner' && caller?.appMode !== 'dad-lite')
    if (allowed) {
      const houseSnap = await db.collection('houses').doc(String(target.houseId || '')).get()
      allowed = houseSnap.exists && ownerCanAccessProperty(caller, String(houseSnap.data()?.propertyId || 'default'))
    }
    allowed = allowed || (caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === target.houseId)
    if (!allowed) return res.status(403).json({ error: 'Not allowed to remove this family account' })
    await auth.deleteUser(uid)
    try {
      await db.collection('users').doc(uid).delete()
      await db.collection('houses').doc(target.houseId).update({ familyAccountCount: FieldValue.increment(-1) })
      const houseSnap = await db.collection('houses').doc(target.houseId).get()
      if (houseSnap.exists && Number(houseSnap.data()?.familyAccountCount || 0) < 0) {
        await houseSnap.ref.update({ familyAccountCount: 0 })
      }
    } catch (cleanupError) {
      // Auth deletion succeeded. Keep the Firestore cleanup retryable and never
      // recreate credentials silently. The caller receives a server error so the
      // operation can be retried safely.
      throw cleanupError
    }
    res.status(200).json({ uid })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to remove family account' })
  }
}
