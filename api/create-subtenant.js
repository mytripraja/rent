import { auth, db, requireAuth, requireOwnerLevel } from '../lib/firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'

const DEFAULTS = {
  rent: true, bills: true, notices: true, complaints: true, maintenance: true,
  visitors: true, commonArea: true, documents: true, directory: true, community: true,
}

function cleanPermissions(input) {
  const out = { ...DEFAULTS }
  if (input && typeof input === 'object') {
    Object.keys(DEFAULTS).forEach((key) => {
      if (typeof input[key] === 'boolean') out[key] = input[key]
    })
  }
  return out
}

async function getProfile(uid) {
  const snap = await db.collection('users').doc(uid).get()
  return snap.exists ? snap.data() : null
}

async function authorize(req, houseId) {
  const decoded = await requireAuth(req)
  const caller = await getProfile(decoded.uid)
  if (!caller) throw Object.assign(new Error('Account profile not found'), { statusCode: 403 })
  if (caller.role === 'admin' || (caller.role === 'owner' && caller.appMode !== 'dad-lite')) return { decoded, caller, isOwner: true }
  if (caller.role === 'tenant' && caller.houseId === houseId && caller.accountType !== 'sub') return { decoded, caller, isOwner: false }
  throw Object.assign(new Error('Only the main tenant or owner can create family accounts'), { statusCode: 403 })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { houseId, email, password, name, phone, relationship, permissions } = req.body || {}
    if (!houseId || !email || !password || !name) return res.status(400).json({ error: 'House, name, email and password are required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password should be at least 6 characters' })

    const { decoded, caller, isOwner } = await authorize(req, houseId)
    const usersSnap = await db.collection('users').where('role', '==', 'tenant').where('houseId', '==', houseId).get()
    const subCount = usersSnap.docs.filter((d) => d.data().accountType === 'sub').length
    if (subCount >= 5) return res.status(400).json({ error: 'Maximum of 5 family accounts has been reached for this house' })

    const userRecord = await auth.createUser({ email, password, displayName: name })
    const callerName = caller.name || 'Tenant'
    await db.collection('users').doc(userRecord.uid).set({
      role: 'tenant',
      accountType: 'sub',
      parentTenantId: isOwner ? (usersSnap.docs.find(d => d.data().accountType !== 'sub')?.id || null) : decoded.uid,
      name,
      email,
      phone: phone || '',
      houseId,
      relationship: relationship || 'Family member',
      tenantPermissions: cleanPermissions(permissions),
      customerId: null,
      createdAt: Date.now(),
      createdBy: { uid: decoded.uid, name: callerName },
      disabled: false,
    })

    // Keep the real person's Customer record separate from the main account.
    // Sub-accounts are intentionally house-scoped family logins rather than a second rent identity.
    await db.collection('houses').doc(houseId).update({
      familyAccountCount: FieldValue.increment(1),
    })

    res.status(200).json({ uid: userRecord.uid })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to create family account' })
  }
}
