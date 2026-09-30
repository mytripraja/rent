import { auth, db, requireAuth, ownerCanAccessProperty } from '../firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'

const PERMISSIONS = ['rent','rentStatus','rentDetails','rentSubmit','bills','notices','complaints','maintenance','visitors','commonArea','documents','directory','community','blueprint','calendar','family','serviceContacts']
function cleanPermissions(input) { return Object.fromEntries(PERMISSIONS.map(k => [k, input && typeof input[k] === 'boolean' ? input[k] : true])) }
async function profile(uid) { const snap = await db.collection('users').doc(uid).get(); return snap.exists ? snap.data() : null }
function deny(message) { return Object.assign(new Error(message), { statusCode: 403 }) }
async function ownerHouseAllowed(caller, houseId) {
  const snap = await db.collection('houses').doc(String(houseId || '')).get()
  if (!snap.exists) return false
  return ownerCanAccessProperty(caller, String(snap.data()?.propertyId || 'default'))
}

export async function create(req, res) {
  const { houseId, email, name, phone, relationship, permissions } = req.body || {}
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!houseId || !normalizedEmail || !name) return res.status(400).json({ error: 'House, name and email are required' })
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid email address' })
  const decoded = await requireAuth(req); const caller = await profile(decoded.uid)
  const ownerAccess = (caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite')) && await ownerHouseAllowed(caller, houseId)
  const primaryAccess = caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === houseId
  if (!ownerAccess && !primaryAccess) throw deny('Only the main tenant or owner can create family accounts')
  const usersSnap = await db.collection('users').where('houseId','==',houseId).get()
  const tenantDocs = usersSnap.docs.filter(d => d.data().role === 'tenant')
  const subCount = tenantDocs.filter(d => d.data().accountType === 'sub').length
  if (subCount >= 5) return res.status(400).json({ error: 'Maximum of 5 family accounts has been reached for this house' })
  const houseSnap = await db.collection('houses').doc(String(houseId)).get()
  if (!houseSnap.exists) return res.status(404).json({ error: 'House not found' })
  const propertyId = String(houseSnap.data()?.propertyId || 'default')
  const userRecord = await auth.createUser({ email: normalizedEmail, displayName: name })
  try {
    await db.collection('users').doc(userRecord.uid).set({ role:'tenant', accountType:'sub', parentTenantId: ownerAccess ? (tenantDocs.find(d=>d.data().accountType !== 'sub')?.id || null) : decoded.uid, name, email: normalizedEmail, phone:phone||'', houseId, propertyId, relationship:relationship||'Family member', tenantPermissions:cleanPermissions(permissions), customerId:null, createdAt:Date.now(), createdBy:{uid:decoded.uid,name:caller?.name||'Tenant'}, disabled:false })

    const link = await auth.generatePasswordResetLink(normalizedEmail, { url: process.env.PASSWORD_RESET_CONTINUE_URL || undefined, handleCodeInApp: false })
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) throw Object.assign(new Error('Email delivery is not configured. Ask the administrator to configure RESEND_API_KEY and EMAIL_FROM.'), { statusCode: 503 })
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [normalizedEmail],
        subject: 'Rental Manager — set up your family login',
        text: `Your Rental Manager family account is ready. Set your password using this secure link: ${link}`,
        html: `<p>Your Rental Manager family account is ready.</p><p><a href="${link}">Set your password and sign in</a></p><p>If you did not expect this message, contact your property administrator.</p>`
      })
    })
    if (!response.ok) throw Object.assign(new Error('Could not send the family login setup email.'), { statusCode: 502 })

    await db.collection('houses').doc(houseId).update({ familyAccountCount: FieldValue.increment(1) })
    await db.collection('auditLogs').add({ action:'family_account_created', targetUid:userRecord.uid, targetEmail:normalizedEmail, houseId, propertyId, actorUid:decoded.uid, actorEmail:decoded.email || null, createdAt:Date.now() })
    return res.status(200).json({ uid:userRecord.uid, setupEmailSent:true })
  } catch (err) {
    try { await auth.deleteUser(userRecord.uid) } catch (cleanupErr) { console.error('Family account rollback failed:', cleanupErr) }
    throw err
  }
}

export async function list(req, res) {
  const decoded = await requireAuth(req); const { houseId } = req.body || {}
  if (!houseId) return res.status(400).json({ error:'House id is required' })
  const caller = await profile(decoded.uid)
  const ownerAccess = (caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite')) && await ownerHouseAllowed(caller, houseId)
  const allowed = ownerAccess || (caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === houseId)
  if (!allowed) throw deny('Not allowed to view family accounts')
  const snap = await db.collection('users').where('houseId','==',houseId).get()
  const rows = snap.docs.filter(d=>d.data().role === 'tenant').map(d=>({uid:d.id,...d.data()})).sort((a,b)=>(a.accountType==='primary'?-1:b.accountType==='primary'?1:(a.name||'').localeCompare(b.name||'')))
  return res.status(200).json(rows)
}

export async function update(req, res) {
  const decoded = await requireAuth(req); const caller = await profile(decoded.uid)
  const { uid, name, phone, relationship, permissions, disabled } = req.body || {}
  if (!uid) return res.status(400).json({ error:'Account id is required' })
  const target = await profile(uid)
  if (!target || target.role !== 'tenant' || target.accountType !== 'sub') return res.status(404).json({ error:'Family account not found' })
  const ownerAccess = (caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite')) && await ownerHouseAllowed(caller, target.houseId)
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
  await db.collection('auditLogs').add({ action:'family_account_updated', targetUid:uid, targetEmail:target.email || null, houseId:target.houseId || null, propertyId:target.propertyId || null, actorUid:decoded.uid, actorEmail:decoded.email || null, createdAt:Date.now() })
  return res.status(200).json({ uid })
}

export async function remove(req, res) {
  const decoded = await requireAuth(req); const caller = await profile(decoded.uid); const { uid } = req.body || {}
  const target = await profile(uid)
  if (!target || target.role !== 'tenant' || target.accountType !== 'sub') return res.status(404).json({ error:'Family account not found' })
  const ownerAccess = (caller?.role === 'admin' || (caller?.role === 'owner' && caller.appMode !== 'dad-lite')) && await ownerHouseAllowed(caller, target.houseId)
  const allowed = ownerAccess || (caller?.role === 'tenant' && caller.accountType !== 'sub' && caller.houseId === target.houseId)
  if (!allowed) throw deny('Not allowed to remove this family account')
  await auth.deleteUser(uid)
  await db.collection('users').doc(uid).delete()
  const houseRef = db.collection('houses').doc(target.houseId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(houseRef)
    if (!snap.exists) return
    const current = Number(snap.data()?.familyAccountCount || 0)
    tx.update(houseRef, { familyAccountCount: Math.max(0, current - 1) })
  })
  await db.collection('auditLogs').add({ action:'family_account_deleted', targetUid:uid, targetEmail:target.email || null, houseId:target.houseId || null, propertyId:target.propertyId || null, actorUid:decoded.uid, actorEmail:decoded.email || null, createdAt:Date.now() })
  return res.status(200).json({ uid })
}
