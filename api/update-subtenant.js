import { auth, db, requireAuth } from '../lib/firebaseAdmin.js'

const DEFAULTS = ['rent','bills','notices','complaints','maintenance','visitors','commonArea','documents','directory','community']

async function profile(uid) {
  const snap = await db.collection('users').doc(uid).get()
  return snap.exists ? snap.data() : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const decoded = await requireAuth(req)
    const caller = await profile(decoded.uid)
    const { uid, name, phone, relationship, permissions, disabled } = req.body || {}
    if (!uid) return res.status(400).json({ error: 'Account id is required' })
    const target = await profile(uid)
    if (!target || target.role !== 'tenant' || target.accountType !== 'sub') return res.status(404).json({ error: 'Family account not found' })

    const ownerAccess = caller?.role === 'admin' || (caller?.role === 'owner' && caller?.appMode !== 'dad-lite')
    const primaryAccess = caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === target.houseId
    if (!ownerAccess && !primaryAccess) return res.status(403).json({ error: 'Not allowed to manage this family account' })

    const updates = {}
    if (name !== undefined) updates.name = String(name).trim()
    if (phone !== undefined) updates.phone = String(phone).trim()
    if (relationship !== undefined) updates.relationship = String(relationship).trim()
    if (typeof disabled === 'boolean') updates.disabled = disabled
    if (permissions && typeof permissions === 'object') {
      updates.tenantPermissions = Object.fromEntries(DEFAULTS.map(k => [k, permissions[k] !== false]))
    }
    await db.collection('users').doc(uid).update(updates)
    if (typeof disabled === 'boolean') await auth.updateUser(uid, { disabled })
    res.status(200).json({ uid })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update family account' })
  }
}
