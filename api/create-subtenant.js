import { auth, db, requireAuth, requireOwnerLevel, ownerCanAccessProperty } from '../lib/firebaseAdmin.js'
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
  if (caller.role === 'admin' || (caller.role === 'owner' && caller.appMode !== 'dad-lite')) {
    const houseSnap = await db.collection('houses').doc(houseId).get()
    if (!houseSnap.exists) throw Object.assign(new Error('House not found'), { statusCode: 404 })
    if (!ownerCanAccessProperty(caller, String(houseSnap.data()?.propertyId || 'default'))) {
      throw Object.assign(new Error('You do not have access to this property'), { statusCode: 403 })
    }
    return { decoded, caller, isOwner: true }
  }
  if (caller.role === 'tenant' && caller.houseId === houseId && caller.accountType !== 'sub') return { decoded, caller, isOwner: false }
  throw Object.assign(new Error('Only the main tenant or owner can create family accounts'), { statusCode: 403 })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { houseId, email, name, phone, relationship, permissions } = req.body || {}
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!houseId || !normalizedEmail || !name) return res.status(400).json({ error: 'House, name and email are required' })
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid email address' })

    const { decoded, caller, isOwner } = await authorize(req, houseId)
    const usersSnap = await db.collection('users').where('houseId', '==', houseId).get()
    const tenantDocs = usersSnap.docs.filter((d) => d.data().role === 'tenant')
    const subCount = tenantDocs.filter((d) => d.data().accountType === 'sub').length
    if (subCount >= 5) return res.status(400).json({ error: 'Maximum of 5 family accounts has been reached for this house' })

    const houseSnap = await db.collection('houses').doc(String(houseId)).get()
    if (!houseSnap.exists) throw Object.assign(new Error('House not found'), { statusCode: 404 })
    const propertyId = String(houseSnap.data()?.propertyId || 'default')
    const userRecord = await auth.createUser({ email: normalizedEmail, displayName: name })
    try {
      const callerName = caller.name || 'Tenant'
      await db.collection('users').doc(userRecord.uid).set({
        role: 'tenant',
        accountType: 'sub',
        parentTenantId: isOwner ? (tenantDocs.find(d => d.data().accountType !== 'sub')?.id || null) : decoded.uid,
        name,
        email: normalizedEmail,
        phone: phone || '',
        houseId,
        propertyId,
        propertyId: String(houseSnap.data()?.propertyId || 'default'),
        relationship: relationship || 'Family member',
        tenantPermissions: cleanPermissions(permissions),
        customerId: null,
        createdAt: Date.now(),
        createdBy: { uid: decoded.uid, name: callerName },
        disabled: false,
      })

      const link = await auth.generatePasswordResetLink(normalizedEmail, { url: process.env.PASSWORD_RESET_CONTINUE_URL || undefined, handleCodeInApp: false })
      const apiKey = process.env.RESEND_API_KEY
      const from = process.env.EMAIL_FROM
      if (!apiKey || !from) throw Object.assign(new Error('Email delivery is not configured. Ask the administrator to configure RESEND_API_KEY and EMAIL_FROM.'), { statusCode: 503 })
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to: [normalizedEmail], subject: 'Rental Manager — set up your family login', text: `Your Rental Manager family account is ready. Set your password using this secure link: ${link}`, html: `<p>Your Rental Manager family account is ready.</p><p><a href="${link}">Set your password and sign in</a></p><p>If you did not expect this message, contact your property administrator.</p>` })
      })
      if (!response.ok) throw Object.assign(new Error('Could not send the family login setup email.'), { statusCode: 502 })

      // Keep the real person's Customer record separate from the main account.
      // Sub-accounts are intentionally house-scoped family logins rather than a second rent identity.
      await db.collection('houses').doc(houseId).update({ familyAccountCount: FieldValue.increment(1) })
      await db.collection('auditLogs').add({ action:'family_account_created', targetUid:userRecord.uid, targetEmail:normalizedEmail, houseId, propertyId, actorUid:decoded.uid, actorEmail:decoded.email || null, createdAt:Date.now() })
    } catch (setupError) {
      await auth.deleteUser(userRecord.uid).catch(() => {})
      await db.collection('users').doc(userRecord.uid).delete().catch(() => {})
      throw setupError
    }

    res.status(200).json({ uid: userRecord.uid, setupEmailSent: true })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to create family account' })
  }
}
