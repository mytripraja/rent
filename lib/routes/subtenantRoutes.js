import { auth, db, requireAuth } from '../firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'

const PERMISSIONS = ['rent','bills','notices','complaints','maintenance','visitors','commonArea','documents','directory','community','blueprint','calendar','news','family','serviceContacts']
function cleanPermissions(input) { return Object.fromEntries(PERMISSIONS.map(k => [k, input && typeof input[k] === 'boolean' ? input[k] : true])) }
async function profile(uid) { const snap = await db.collection('users').doc(uid).get(); return snap.exists ? snap.data() : null }
function deny(message) { return Object.assign(new Error(message), { statusCode: 403 }) }

export async function create(req, res) {
  const { houseId, email, password, name, phone, relationship, permissions } = req.body || {}
  if (!houseId || !email || !password || !name) return res.status(400).json({ error: 'House, name, email and password are required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password should be at least 6 characters' })
  const decoded = await requireAuth(req); const caller = await profile(decoded.uid)
  const ownerAccess = caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite')
  const primaryAccess = caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === houseId
  if (!ownerAccess && !primaryAccess) throw deny('Only the main tenant or owner can create family accounts')
  const usersSnap = await db.collection('users').where('role','==','tenant').where('houseId','==',houseId).get()
  const subCount = usersSnap.docs.filter(d => d.data().accountType === 'sub').length
  if (subCount >= 5) return res.status(400).json({ error: 'Maximum of 5 family accounts has been reached for this house' })
  const userRecord = await auth.createUser({ email, password, displayName: name })
  await db.collection('users').doc(userRecord.uid).set({ role:'tenant', accountType:'sub', parentTenantId: ownerAccess ? (usersSnap.docs.find(d=>d.data().accountType !== 'sub')?.id || null) : decoded.uid, name, email, phone:phone||'', houseId, relationship:relationship||'Family member', tenantPermissions:cleanPermissions(permissions), customerId:null, createdAt:Date.now(), createdBy:{uid:decoded.uid,name:caller?.name||'Tenant'}, disabled:false })
  await db.collection('houses').doc(houseId).update({ familyAccountCount: FieldValue.increment(1) })
  return res.status(200).json({ uid:userRecord.uid })
}

export async function list(req, res) {
  const decoded = await requireAuth(req); const { houseId } = req.body || {}
  if (!houseId) return res.status(400).json({ error:'House id is required' })
  const caller = await profile(decoded.uid)
  const allowed = caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite') || (caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === houseId)
  if (!allowed) throw deny('Not allowed to view family accounts')
  const snap = await db.collection('users').where('role','==','tenant').where('houseId','==',houseId).get()
  const rows = snap.docs.map(d=>({uid:d.id,...d.data()})).sort((a,b)=>(a.accountType==='primary'?-1:b.accountType==='primary'?1:(a.name||'').localeCompare(b.name||'')))
  return res.status(200).json(rows)
}

export async function update(req, res) {
  const decoded = await requireAuth(req); const caller = await profile(decoded.uid)
  const { uid, name, phone, relationship, permissions, disabled } = req.body || {}
  if (!uid) return res.status(400).json({ error:'Account id is required' })
  const target = await profile(uid)
  if (!target || target.role !== 'tenant' || target.accountType !== 'sub') return res.status(404).json({ error:'Family account not found' })
  const ownerAccess = caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite')
  const primaryAccess = caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === target.houseId
  if (!ownerAccess && !primaryAccess) throw deny('Not allowed to manage this family account')
  const updates = {}
  if (name !== undefined) updates.name = String(name).trim()
  if (phone !== undefined) updates.phone = String(phone).trim()
  if (relationship !== undefined) updates.relationship = String(relationship).trim()
  if (typeof disabled === 'boolean') updates.disabled = disabled
  if (permissions && typeof permissions === 'object') updates.tenantPermissions = cleanPermissions(permissions)
  await db.collection('users').doc(uid).update(updates)
  if (typeof disabled === 'boolean') await auth.updateUser(uid, { disabled })
  return res.status(200).json({ uid })
}

export async function remove(req, res) {
  const decoded = await requireAuth(req); const caller = await profile(decoded.uid); const { uid } = req.body || {}
  const target = await profile(uid)
  if (!target || target.role !== 'tenant' || target.accountType !== 'sub') return res.status(404).json({ error:'Family account not found' })
  const allowed = caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite') || (caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === target.houseId)
  if (!allowed) throw deny('Not allowed to remove this family account')
  await auth.deleteUser(uid); await db.collection('users').doc(uid).delete(); await db.collection('houses').doc(target.houseId).update({ familyAccountCount:Math.max(0,Number(target.familyAccountCount||1)-1) })
  return res.status(200).json({ uid })
}
