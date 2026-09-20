import { auth, db, requireAuth } from '../lib/firebaseAdmin.js'

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
    const allowed = caller?.role === 'admin' || (caller?.role === 'owner' && caller?.appMode !== 'dad-lite') || (caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === target.houseId)
    if (!allowed) return res.status(403).json({ error: 'Not allowed to remove this family account' })
    await auth.deleteUser(uid)
    await db.collection('users').doc(uid).delete()
    await db.collection('houses').doc(target.houseId).update({ familyAccountCount: Math.max(0, Number(target.familyAccountCount || 1) - 1) })
    res.status(200).json({ uid })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to remove family account' })
  }
}
