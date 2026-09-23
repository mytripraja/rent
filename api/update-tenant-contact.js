import crypto from 'node:crypto'
import { auth, db, requireAuth, requireAdmin, requireOwnerLevel } from '../lib/firebaseAdmin.js'

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value) { return String(value || '').trim().toLowerCase() }
function hashOtp(otp, salt) { return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex') }
function makeOtp() { return String(crypto.randomInt(100000, 1000000)) }
function safeEmail(value) { const e = normalizeEmail(value); if (!EMAIL_RE.test(e) || e.length > 320) throw new Error('Enter a valid email address.') ; return e }

async function sendEmail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) {
    const err = new Error('Email delivery is not configured. Ask the administrator to configure RESEND_API_KEY and EMAIL_FROM.')
    err.statusCode = 503
    throw err
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const err = new Error(`Email delivery failed${body ? `: ${body.slice(0, 180)}` : '.'}`)
    err.statusCode = 502
    throw err
  }
}

async function ensureEmailAvailable(email, uid) {
  try {
    const existing = await auth.getUserByEmail(email)
    if (existing.uid !== uid) {
      const err = new Error('That email address is already used by another account.')
      err.statusCode = 409
      throw err
    }
    const err = new Error('New email must be different from the current email.')
    err.statusCode = 400
    throw err
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return
    throw err
  }
}

async function getUserDoc(uid) {
  const snap = await db.collection('users').doc(uid).get()
  if (!snap.exists) { const err = new Error('Account profile not found.'); err.statusCode = 404; throw err }
  return snap.data() || {}
}

async function updateRelatedRecords(uid, profile, oldEmail, newEmail) {
  const updates = { email: newEmail, emailChangedAt: Date.now(), previousEmail: oldEmail }
  await db.collection('users').doc(uid).update(updates)

  const customerSnap = await db.collection('customers').where('linkedUids', 'array-contains', uid).get()
  for (const customer of customerSnap.docs) {
    await customer.ref.update({ email: newEmail, emailChangedAt: Date.now() })
    await db.collection('customerLookup').doc(customer.id).set({ email: newEmail }, { merge: true })
  }

  const houseId = profile.houseId
  if (profile.role === 'tenant' && houseId) {
    const houseRef = db.collection('houses').doc(houseId)
    const houseSnap = await houseRef.get()
    if (houseSnap.exists) {
      const house = houseSnap.data() || {}
      await houseRef.update({ tenantEmail: newEmail, emailChangedAt: Date.now() })
      await db.collection('directory').doc(houseId).set({
        internalDoorNumber: house.internalDoorNumber,
        status: house.status,
        tenantName: house.tenantName,
        tenantPhone: house.phoneVisibleToNeighbors ? house.tenantPhone : null,
        phoneVisibleToNeighbors: !!house.phoneVisibleToNeighbors,
      }, { merge: true })
    }
  }
}

async function applyEmailChange(uid, newEmail, actor) {
  const profile = await getUserDoc(uid)
  const oldEmail = normalizeEmail(profile.email || '')
  if (!oldEmail) { const err = new Error('Current account email is missing.'); err.statusCode = 400; throw err }
  newEmail = safeEmail(newEmail)
  await ensureEmailAvailable(newEmail, uid)

  await auth.updateUser(uid, { email: newEmail, emailVerified: false })
  try {
    await updateRelatedRecords(uid, profile, oldEmail, newEmail)
  } catch (err) {
    // Best-effort rollback so Auth and Firestore do not stay out of sync.
    try { await auth.updateUser(uid, { email: oldEmail, emailVerified: false }) } catch {}
    throw err
  }

  await db.collection('activityLog').add({
    type: 'email_changed',
    actorUid: actor.uid,
    actorName: actor.name || actor.email || 'System',
    targetUid: uid,
    oldEmail,
    newEmail,
    createdAt: Date.now(),
  })
  return { uid, oldEmail, newEmail }
}

async function requestEmailChange(req, res) {
  const decoded = await requireAuth(req)
  const profile = await getUserDoc(decoded.uid)
  const oldEmail = normalizeEmail(decoded.email || profile.email || '')
  if (!oldEmail) return res.status(400).json({ error: 'Your account does not have a current email address.' })

  const newEmail = safeEmail(req.body?.newEmail)
  if (newEmail === oldEmail) return res.status(400).json({ error: 'New email must be different from your current email.' })
  await ensureEmailAvailable(newEmail, decoded.uid)

  const oldEmailUnavailable = !!req.body?.oldEmailUnavailable
  const reason = String(req.body?.reason || '').trim().slice(0, 1000)
  if (oldEmailUnavailable && !reason) return res.status(400).json({ error: 'Please explain why you cannot access the old email address.' })

  // Cancel older pending requests for this user so only the newest request can be used.
  const existing = await db.collection('emailChangeRequests').where('uid', '==', decoded.uid).where('status', '==', 'pending').get()
  const batch = db.batch()
  existing.docs.forEach(d => batch.update(d.ref, { status: 'superseded', updatedAt: Date.now() }))
  await batch.commit()

  const ref = db.collection('emailChangeRequests').doc()
  const now = Date.now()
  const base = {
    uid: decoded.uid,
    role: profile.role || 'unknown',
    oldEmail,
    newEmail,
    oldEmailUnavailable,
    reason,
    status: oldEmailUnavailable ? 'pending_admin' : 'pending_otp',
    createdAt: now,
    updatedAt: now,
    expiresAt: now + REQUEST_TTL_MS,
    otpExpiresAt: now + OTP_TTL_MS,
    oldOtpAttempts: 0,
    newOtpAttempts: 0,
    createdIp: String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim().slice(0, 80),
  }

  if (oldEmailUnavailable) {
    await ref.set(base)
    return res.status(200).json({ ok: true, mode: 'admin_review', message: 'Your request was submitted for administrator review.' })
  }

  const oldOtp = makeOtp()
  const newOtp = makeOtp()
  const salt = crypto.randomBytes(16).toString('hex')
  await ref.set({ ...base, otpSalt: salt, oldOtpHash: hashOtp(oldOtp, salt), newOtpHash: hashOtp(newOtp, salt) })

  try {
    await Promise.all([
      sendEmail({
        to: oldEmail,
        subject: 'Rental Manager — verify your email change',
        text: `Your Rental Manager email-change OTP is ${oldOtp}. It expires in 10 minutes. If you did not request this, ignore this message.`,
        html: `<p>Your Rental Manager email-change verification code is:</p><h2 style="letter-spacing:6px">${oldOtp}</h2><p>It expires in 10 minutes. If you did not request this, ignore this message.</p>`,
      }),
      sendEmail({
        to: newEmail,
        subject: 'Rental Manager — verify your new email',
        text: `Your Rental Manager new-email verification OTP is ${newOtp}. It expires in 10 minutes. If you did not request this, ignore this message.`,
        html: `<p>Your Rental Manager new-email verification code is:</p><h2 style="letter-spacing:6px">${newOtp}</h2><p>It expires in 10 minutes. It is only valid for this email-change request.</p>`,
      }),
    ])
  } catch (err) {
    await ref.update({ status: 'delivery_failed', updatedAt: Date.now(), deliveryError: err.message.slice(0, 300) })
    throw err
  }

  return res.status(200).json({ ok: true, mode: 'otp', requestId: ref.id, expiresAt: now + OTP_TTL_MS, message: 'Verification codes were sent to your old and new email addresses.' })
}

async function verifyEmailChange(req, res) {
  const decoded = await requireAuth(req)
  const requestId = String(req.body?.requestId || '')
  const oldOtp = String(req.body?.oldOtp || '').trim()
  const newOtp = String(req.body?.newOtp || '').trim()
  if (!requestId || !/^\d{6}$/.test(oldOtp) || !/^\d{6}$/.test(newOtp)) return res.status(400).json({ error: 'Enter both 6-digit verification codes.' })

  const ref = db.collection('emailChangeRequests').doc(requestId)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.uid !== decoded.uid) return res.status(404).json({ error: 'Email-change request not found.' })
  const data = snap.data()
  if (data.status !== 'pending_otp') return res.status(400).json({ error: 'This request is no longer active.' })
  if (Number(data.otpExpiresAt || 0) < Date.now()) { await ref.update({ status: 'expired', updatedAt: Date.now() }); return res.status(400).json({ error: 'The verification codes have expired. Start a new request.' }) }
  if (Number(data.oldOtpAttempts || 0) >= MAX_OTP_ATTEMPTS || Number(data.newOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) return res.status(429).json({ error: 'Too many incorrect attempts. Start a new request.' })

  const salt = data.otpSalt
  const oldOk = crypto.timingSafeEqual(Buffer.from(hashOtp(oldOtp, salt)), Buffer.from(data.oldOtpHash || ''))
  const newOk = crypto.timingSafeEqual(Buffer.from(hashOtp(newOtp, salt)), Buffer.from(data.newOtpHash || ''))
  if (!oldOk || !newOk) {
    await ref.update({ oldOtpAttempts: Number(data.oldOtpAttempts || 0) + (oldOk ? 0 : 1), newOtpAttempts: Number(data.newOtpAttempts || 0) + (newOk ? 0 : 1), updatedAt: Date.now() })
    return res.status(400).json({ error: 'One or both verification codes are incorrect.' })
  }

  const actor = { uid: decoded.uid, name: (await getUserDoc(decoded.uid)).name, email: decoded.email }
  const result = await applyEmailChange(decoded.uid, data.newEmail, actor)
  await ref.update({ status: 'approved', verifiedAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now() })
  return res.status(200).json({ ok: true, ...result })
}

async function adminList(req, res) {
  const decoded = await requireAdmin(req)
  const snap = await db.collection('emailChangeRequests').where('status', '==', 'pending_admin').limit(50).get()
  return res.status(200).json({ requests: snap.docs.map(d => ({ id: d.id, ...d.data(), oldOtpHash: undefined, newOtpHash: undefined, otpSalt: undefined })) })
}

async function adminDecision(req, res, approve) {
  const decoded = await requireAdmin(req)
  const requestId = String(req.body?.requestId || '')
  if (!requestId) return res.status(400).json({ error: 'Request ID is required.' })
  const ref = db.collection('emailChangeRequests').doc(requestId)
  const snap = await ref.get()
  if (!snap.exists) return res.status(404).json({ error: 'Request not found.' })
  const data = snap.data()
  if (data.status !== 'pending_admin') return res.status(400).json({ error: 'Only administrator-review requests can be approved here.' })

  const adminProfile = await getUserDoc(decoded.uid)
  if (!approve) {
    await ref.update({ status: 'rejected', reviewedAt: Date.now(), reviewedBy: { uid: decoded.uid, name: adminProfile.name || 'Admin' }, reviewNote: String(req.body?.note || '').slice(0, 1000) })
    return res.status(200).json({ ok: true })
  }

  const result = await applyEmailChange(data.uid, data.newEmail, { uid: decoded.uid, name: adminProfile.name || 'Admin', email: decoded.email })
  await ref.update({ status: 'approved', reviewedAt: Date.now(), reviewedBy: { uid: decoded.uid, name: adminProfile.name || 'Admin' }, completedAt: Date.now(), updatedAt: Date.now() })
  return res.status(200).json({ ok: true, ...result })
}


async function adminListUsers(req, res) {
  await requireAdmin(req)
  const result = await auth.listUsers(200)
  const users = await Promise.all(result.users.map(async u => {
    const profile = (await db.collection('users').doc(u.uid).get()).data() || {}
    return {
      uid: u.uid, email: u.email || profile.email || null, displayName: u.displayName || profile.name || null,
      role: profile.role || null, name: profile.name || u.displayName || null, appMode: profile.appMode || null,
      disabled: !!u.disabled, emailVerified: !!u.emailVerified,
      createdAt: u.metadata?.creationTime || null, lastSignInAt: u.metadata?.lastSignInTime || null,
    }
  }))
  return res.status(200).json({ users })
}

async function adminSetDisabled(req, res) {
  const decoded = await requireAdmin(req)
  const uid = String(req.body?.uid || '')
  const disabled = !!req.body?.disabled
  if (!uid) return res.status(400).json({ error: 'User ID is required.' })
  if (uid === decoded.uid && disabled) return res.status(400).json({ error: 'You cannot disable your own administrator account.' })
  const target = await auth.getUser(uid)
  await auth.updateUser(uid, { disabled })
  const adminDoc = await getUserDoc(decoded.uid)
  await db.collection('users').doc(uid).set({ disabled, accountStatusUpdatedAt: Date.now(), accountStatusUpdatedBy: { uid: decoded.uid, name: adminDoc.name || 'Admin' } }, { merge: true })
  await db.collection('auditLogs').add({ action: disabled ? 'account_disabled' : 'account_enabled', targetUid: uid, targetEmail: target.email || null, actorUid: decoded.uid, actorEmail: decoded.email || null, createdAt: Date.now() })
  return res.status(200).json({ ok: true, disabled })
}

async function adminRevokeSessions(req, res) {
  const decoded = await requireAdmin(req)
  const uid = String(req.body?.uid || '')
  if (!uid) return res.status(400).json({ error: 'User ID is required.' })
  await auth.revokeRefreshTokens(uid)
  await db.collection('auditLogs').add({ action: 'sessions_revoked', targetUid: uid, actorUid: decoded.uid, actorEmail: decoded.email || null, createdAt: Date.now() })
  return res.status(200).json({ ok: true, revokedAt: Date.now() })
}

async function adminSendPasswordReset(req, res) {
  const decoded = await requireAdmin(req)
  const uid = String(req.body?.uid || '')
  if (!uid) return res.status(400).json({ error: 'User ID is required.' })
  const target = await auth.getUser(uid)
  if (!target.email) return res.status(400).json({ error: 'This account has no email address.' })
  const link = await auth.generatePasswordResetLink(target.email, { url: process.env.PASSWORD_RESET_CONTINUE_URL || undefined, handleCodeInApp: false })
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return res.status(503).json({ error: 'Password reset email service is not configured.' })
  const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`}, body: JSON.stringify({ from, to:[target.email], subject:'Rental Manager — password reset', text:`An administrator requested a password reset for your Rental Manager account. Use this secure link: ${link}`, html:`<p>An administrator requested a password reset for your Rental Manager account.</p><p><a href="${link}">Reset your password</a></p><p>If you did not expect this, contact your administrator.</p>` }) })
  if (!response.ok) throw new Error('Could not send the password reset email.')
  await db.collection('auditLogs').add({ action: 'admin_password_reset_sent', targetUid: uid, targetEmail: target.email, actorUid: decoded.uid, actorEmail: decoded.email || null, createdAt: Date.now() })
  return res.status(200).json({ ok: true })
}

// Existing owner-level tenant contact endpoint + secure self-service email-change workflow.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    const action = String(req.body?.action || 'tenant-contact')
    if (action === 'email-change-request') return await requestEmailChange(req, res)
    if (action === 'email-change-verify') return await verifyEmailChange(req, res)
    if (action === 'email-change-admin-list') return await adminList(req, res)
    if (action === 'email-change-admin-approve') return await adminDecision(req, res, true)
    if (action === 'email-change-admin-reject') return await adminDecision(req, res, false)
    if (action === 'admin-list-users') return await adminListUsers(req, res)
    if (action === 'admin-set-disabled') return await adminSetDisabled(req, res)
    if (action === 'admin-revoke-sessions') return await adminRevokeSessions(req, res)
    if (action === 'admin-send-password-reset') return await adminSendPasswordReset(req, res)

    const decoded = await requireOwnerLevel(req)
    const callerDoc = await db.collection('users').doc(decoded.uid).get()
    const editedBy = { uid: decoded.uid, name: callerDoc.data()?.name || 'Owner' }
    const { tenantUid, houseId, newEmail, newPhone } = req.body || {}
    if (!tenantUid || !houseId) return res.status(400).json({ error: 'Missing required fields' })
    if (newEmail) await auth.updateUser(tenantUid, { email: newEmail })
    const updates = { editedAt: Date.now(), editedBy }
    if (newEmail) updates.email = newEmail
    if (newPhone) updates.phone = newPhone
    await db.collection('users').doc(tenantUid).update(updates)
    const houseUpdates = { ...updates }
    if (newEmail) houseUpdates.tenantEmail = newEmail
    if (newPhone) houseUpdates.tenantPhone = newPhone
    delete houseUpdates.email; delete houseUpdates.phone
    await db.collection('houses').doc(houseId).update(houseUpdates)
    const houseDoc = await db.collection('houses').doc(houseId).get()
    const house = houseDoc.data()
    await db.collection('directory').doc(houseId).set({
      internalDoorNumber: house.internalDoorNumber,
      status: house.status,
      tenantName: house.tenantName,
      tenantPhone: house.phoneVisibleToNeighbors ? house.tenantPhone : null,
      phoneVisibleToNeighbors: !!house.phoneVisibleToNeighbors,
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('update-tenant-contact/email-change:', err)
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
