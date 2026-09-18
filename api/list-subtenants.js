import { db, requireAuth } from '../lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const decoded = await requireAuth(req)
    const { houseId } = req.body || {}
    if (!houseId) return res.status(400).json({ error: 'House id is required' })
    const callerSnap = await db.collection('users').doc(decoded.uid).get()
    const caller = callerSnap.data()
    const allowed = caller?.role === 'admin' || (caller?.role === 'owner' && caller?.appMode !== 'dad-lite') || (caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === houseId)
    if (!allowed) return res.status(403).json({ error: 'Not allowed to view family accounts' })
    const snap = await db.collection('users').where('role', '==', 'tenant').where('houseId', '==', houseId).get()
    const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a,b) => (a.accountType === 'primary' ? -1 : b.accountType === 'primary' ? 1 : (a.name||'').localeCompare(b.name||'')))
    return res.status(200).json(rows)
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Failed to load family accounts' })
  }
}
