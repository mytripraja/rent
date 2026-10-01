import appConfigHandler from '../lib/appConfigHandler.js'
import { db, requireOwnerLevel } from '../lib/firebaseAdmin.js'
import crypto from 'node:crypto'

function ownerScope(profile) {
  const isAdmin = profile.role === 'admin'
  const unrestricted = profile.role === 'owner' && profile.appMode !== 'dad-lite' && (
    !Object.prototype.hasOwnProperty.call(profile, 'propertyAccess') ||
    (Array.isArray(profile.propertyAccess) && profile.propertyAccess.includes('*'))
  )
  return { isAdmin, unrestricted, allowed: new Set(Array.isArray(profile.propertyAccess) ? profile.propertyAccess.map(String) : []) }
}

async function publicNotice(req, res) {
  const id = String(req.query?.id || '')
  const token = String(req.query?.token || '')
  if (!id || !token || id.length > 160 || token.length > 200) return res.status(400).json({ error: 'Invalid announcement link' })
  const snap = await db.collection('notices').doc(id).get()
  if (!snap.exists) return res.status(404).json({ error: 'Announcement not found' })
  const data = snap.data() || {}
  if (!data.publicShareEnabled || data.publicToken !== token) return res.status(404).json({ error: 'Announcement link is invalid or disabled' })
  let affectedHomes = []
  if (Array.isArray(data.targetHouseIds)) {
    const refs = data.targetHouseIds.slice(0, 50).map(houseId => db.collection('houses').doc(String(houseId)))
    const houseSnaps = refs.length ? await db.getAll(...refs) : []
    affectedHomes = houseSnaps.filter(s => s.exists).map(s => String(s.data()?.internalDoorNumber || s.id)).filter(Boolean)
  }
  const updates = []
  let cursor = data.parentNoticeId ? String(data.parentNoticeId) : ''
  const seen = new Set([id])
  for (let i = 0; i < 8 && cursor; i += 1) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const parentSnap = await db.collection('notices').doc(cursor).get()
    if (!parentSnap.exists) break
    const parent = parentSnap.data() || {}
    if (parent.publicShareEnabled === false || !parent.publicToken) break
    updates.push({
      id: cursor,
      title: parent.title || parent.message || 'Announcement',
      titleTamil: parent.titleTamil || '',
      message: parent.message || '',
      messageTamil: parent.messageTamil || '',
      updateNumber: Number(parent.updateNumber || 1),
      continuationLabel: parent.continuationLabel || null,
      createdAt: parent.createdAt || null,
      shareUrl: `/notice/${cursor}?token=${encodeURIComponent(parent.publicToken)}`,
    })
    cursor = parent.parentNoticeId ? String(parent.parentNoticeId) : ''
  }
  const linkedIds = Array.isArray(data.linkedNoticeIds) ? data.linkedNoticeIds.slice(0, 20).map(String) : []
  const linkedSnaps = linkedIds.length ? await db.getAll(...linkedIds.map(linkedId => db.collection('notices').doc(linkedId))) : []
  const basePropertyId = String(data.propertyId || 'default')
  const linkedAnnouncements = linkedSnaps
    .filter(s => s.exists && String(s.data()?.propertyId || 'default') === basePropertyId && (s.data()?.publicShareEnabled !== false) && s.data()?.publicToken)
    .map(s => {
      const linked = s.data() || {}
      return {
        id: s.id,
        title: linked.title || linked.message || 'Announcement',
        titleTamil: linked.titleTamil || '',
        message: linked.message || '',
        messageTamil: linked.messageTamil || '',
        category: linked.category || linked.type || 'Notice',
        updateNumber: Number(linked.updateNumber || 0) || null,
        createdAt: linked.createdAt || null,
        shareUrl: `/notice/${s.id}?token=${encodeURIComponent(linked.publicToken)}`,
      }
    })

  const notice = {
    title: data.title || data.message || 'Announcement', titleTamil: data.titleTamil || '',
    category: data.category || data.type || 'Notice', categoryTamil: data.categoryTamil || '',
    message: data.message || '', messageTamil: data.messageTamil || '',
    additionalDetails: data.additionalDetails || '', additionalDetailsTamil: data.additionalDetailsTamil || '',
    reason: data.reason || '', reasonTamil: data.reasonTamil || '',
    happenedAt: data.happenedAt || null, expectedResolutionAt: data.expectedResolutionAt || null,
    resolvedAt: data.resolvedAt || null, status: data.status || 'active', targetHouseIds: data.targetHouseIds || 'all',
    affectedHomes: data.targetHouseIds === 'all' ? [] : affectedHomes, imageUrl: data.imageUrl || null,
    updateNumber: Number(data.updateNumber || 0) || null, continuationLabel: data.continuationLabel || null,
    parentNoticeId: data.parentNoticeId || null, previousUpdates: updates, linkedAnnouncements,
    showTimeDetails: data.showTimeDetails !== false,
  }
  res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=30')
  return res.status(200).json({ notice })
}

async function ownerHouses(req, res) {
  const decoded = await requireOwnerLevel(req)
  const profileSnap = await db.collection('users').doc(decoded.uid).get()
  const profile = profileSnap.data() || {}
  const { isAdmin, unrestricted, allowed } = ownerScope(profile)
  const snap = await db.collection('houses').get()
  const houses = snap.docs.map(d => ({ id: d.id, ...d.data(), propertyId: d.data()?.propertyId || 'default' }))
    .filter(h => isAdmin || unrestricted || allowed.has(String(h.propertyId)))
    .sort((a, b) => String(a.internalDoorNumber || '').localeCompare(String(b.internalDoorNumber || ''), undefined, { numeric: true }))
  return res.status(200).json({ houses })
}


async function pendingRentApprovals(req, res) {
  const decoded = await requireOwnerLevel(req)
  const profileSnap = await db.collection('users').doc(decoded.uid).get()
  const profile = profileSnap.data() || {}
  const { isAdmin, unrestricted, allowed } = ownerScope(profile)
  const propertyId = String(req.body?.propertyId || 'default')
  const requestedHouseIds = new Set(Array.isArray(req.body?.houseIds) ? req.body.houseIds.map(String) : [])

  // Scope to accessible houses first, then query payments only for those
  // houses. This avoids scanning the entire rentPayments collection for every
  // apartment approval screen and does not require a composite index.
  const houseSnap = await db.collection('houses').get()
  const houses = houseSnap.docs
    .map(d => ({ id:d.id, ...d.data(), propertyId:String(d.data()?.propertyId || 'default') }))
    .filter(h => (isAdmin || unrestricted || allowed.has(h.propertyId)) && h.propertyId === propertyId)
    .filter(h => !requestedHouseIds.size || requestedHouseIds.has(h.id))
  const houseMap = new Map(houses.map(h => [h.id, h]))
  const houseIds = houses.map(h => h.id)
  const chunks = []
  for (let i = 0; i < houseIds.length; i += 30) chunks.push(houseIds.slice(i, i + 30))
  const paymentSnaps = await Promise.all(chunks.map(ids =>
    db.collection('rentPayments').where('houseId', 'in', ids).get()
  ))
  const seen = new Map()
  paymentSnaps.forEach(snap => snap.docs.forEach(d => {
    const p = d.data() || {}
    if (p.status === 'waiting_approval' && houseMap.has(String(p.houseId || ''))) {
      const h = houseMap.get(String(p.houseId))
      seen.set(d.id, {
        id:d.id, ...p,
        _house:{ id:h.id, internalDoorNumber:h.internalDoorNumber || null,
          tenantName:h.tenantName || null, tenantPhone:h.tenantPhone || null,
          rentAmount:Number(h.rentAmount || 0), propertyId:h.propertyId }
      })
    }
  }))
  const payments = [...seen.values()].sort((a,b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0))
  return res.status(200).json({ payments })
}

async function ownerDocuments(req, res) {
  const decoded = await requireOwnerLevel(req)
  const profileSnap = await db.collection('users').doc(decoded.uid).get()
  const profile = profileSnap.data() || {}
  const { isAdmin, unrestricted, allowed } = ownerScope(profile)
  const houseSnap = await db.collection('houses').get()
  const houses = houseSnap.docs.map(d => ({ id: d.id, ...d.data(), propertyId: d.data()?.propertyId || 'default' }))
    .filter(h => isAdmin || unrestricted || allowed.has(String(h.propertyId)))
  const houseIds = new Set(houses.map(h => h.id))
  const docSnap = await db.collection('documents').get()
  const documents = docSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(d => houseIds.has(String(d.houseId || '')))
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0))
  return res.status(200).json({ houses, documents })
}


const KEY_TTL_MS = 365 * 24 * 60 * 60 * 1000
const RESET_TTL_MS = 10 * 60 * 1000
function hashSensitiveKey(value, salt) {
  return crypto.scryptSync(String(value), String(salt), 32).toString('hex')
}
function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

// Rate-limit critical-key guesses across both the settings verifier and
// sensitive correction endpoints. The counter is stored per authenticated owner.
async function verifyCriticalKey(uid, key) {
  const ref = db.collection('users').doc(uid)
  const now = Date.now()
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref)
    const profile = snap.data() || {}
    const lockedUntil = Number(profile.sensitiveKeyVerifyLockedUntil || 0)
    if (lockedUntil > now) return 'locked'
    if (!profile.sensitiveKeyHash || !profile.sensitiveKeySalt) return 'unconfigured'
    const valid = key.length <= 128 && safeEqualHex(hashSensitiveKey(key, profile.sensitiveKeySalt), profile.sensitiveKeyHash)
    if (valid) {
      if (Number(profile.sensitiveKeyVerifyAttempts || 0) || lockedUntil) {
        tx.set(ref, { sensitiveKeyVerifyAttempts: 0, sensitiveKeyVerifyLockedUntil: 0 }, { merge: true })
      }
      return 'ok'
    }
    const attempts = Number(profile.sensitiveKeyVerifyAttempts || 0) + 1
    const lock = attempts >= 5 ? now + 15 * 60 * 1000 : 0
    tx.set(ref, { sensitiveKeyVerifyAttempts: lock ? 0 : attempts, sensitiveKeyVerifyLockedUntil: lock }, { merge: true })
    return lock ? 'locked' : 'incorrect'
  })
}
async function sensitiveKey(req, res) {
  const decoded = await requireOwnerLevel(req)
  const action = String(req.body?.action || '')
  const ref = db.collection('users').doc(decoded.uid)
  const snap = await ref.get()
  const profile = snap.data() || {}
  if (action === 'status') {
    return res.status(200).json({ configured: !!profile.sensitiveKeyHash, updatedAt: profile.sensitiveKeyUpdatedAt || null })
  }
  if (action === 'set') {
    const key = String(req.body?.key || '')
    if (key.length < 8 || key.length > 128) return res.status(400).json({ error: 'Critical change password must be 8 to 128 characters.' })
    const salt = crypto.randomBytes(16).toString('hex')
    const now = Date.now()
    const created = await db.runTransaction(async tx => {
      const currentSnap = await tx.get(ref)
      const current = currentSnap.data() || {}
      // Initial setup only. Once configured, changing the key must use the
      // email-confirmed reset flow; this also prevents concurrent setup races.
      if (current.sensitiveKeyHash || current.sensitiveKeySalt) return false
      tx.set(ref, { sensitiveKeyHash: hashSensitiveKey(key, salt), sensitiveKeySalt: salt, sensitiveKeyUpdatedAt: now }, { merge: true })
      return true
    })
    if (!created) return res.status(409).json({ error: 'A critical change password is already configured. Use the email reset flow to change it.' })
    return res.status(200).json({ ok: true })
  }
  if (action === 'verify') {
    const key = String(req.body?.key || '')
    if (!key || key.length > 128) return res.status(400).json({ error: 'Enter a valid critical change password.' })
    const result = await verifyCriticalKey(decoded.uid, key)
    if (result === 'unconfigured') return res.status(400).json({ error: 'Set the critical change password in Security Settings first.' })
    if (result === 'locked') return res.status(429).json({ error: 'Too many incorrect attempts. Try again in 15 minutes.' })
    if (result !== 'ok') return res.status(403).json({ error: 'Incorrect critical change password.' })
    return res.status(200).json({ ok: true })
  }
  if (action === 'reset-request') {
    const email = String(decoded.email || profile.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'No email address is available for password recovery.' })
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) return res.status(503).json({ error: 'Email delivery is not configured. Configure RESEND_API_KEY and EMAIL_FROM.' })
    const now = Date.now()
    const code = String(crypto.randomInt(100000, 1000000))
    const salt = crypto.randomBytes(16).toString('hex')
    const requestResult = await db.runTransaction(async tx => {
      const currentSnap = await tx.get(ref)
      const current = currentSnap.data() || {}
      if (Number(current.sensitiveKeyResetRequestedAt || 0) > now - 60 * 1000) return false
      tx.set(ref, { sensitiveKeyResetHash: hashSensitiveKey(code, salt), sensitiveKeyResetSalt: salt,
        sensitiveKeyResetExpiresAt: now + RESET_TTL_MS, sensitiveKeyResetAttempts: 0,
        sensitiveKeyResetRequestedAt: now }, { merge: true })
      return true
    })
    if (!requestResult) return res.status(429).json({ error: 'Please wait one minute before requesting another reset code.' })
    let response = null
    try {
      response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}, body:JSON.stringify({from,to:[email],subject:'Rental Manager — critical change password reset',text:`Your critical change password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,html:`<p>Your Rental Manager critical change password reset code is:</p><h2 style="letter-spacing:6px">${code}</h2><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`}) })
    } catch { /* Treat transport failures like provider rejection and clean up below. */ }
    if (!response?.ok) {
      // The reset code was stored before delivery. If email delivery fails,
      // clear only this request's state so the user is not locked out by a
      // code they never received. A newer request must remain untouched.
      await db.runTransaction(async tx => {
        const currentSnap = await tx.get(ref)
        const current = currentSnap.data() || {}
        if (Number(current.sensitiveKeyResetRequestedAt || 0) === now) {
          tx.set(ref, { sensitiveKeyResetHash: null, sensitiveKeyResetSalt: null,
            sensitiveKeyResetExpiresAt: null, sensitiveKeyResetAttempts: 0,
            sensitiveKeyResetRequestedAt: null }, { merge: true })
        }
      })
      return res.status(502).json({ error: 'Could not send the reset email. Please try requesting a new code.' })
    }
    return res.status(200).json({ ok:true, expiresAt:now + RESET_TTL_MS })
  }
  if (action === 'reset-confirm') {
    const code = String(req.body?.code || '')
    const key = String(req.body?.key || '')
    if (key.length < 8 || key.length > 128) return res.status(400).json({ error: 'Critical change password must be 8 to 128 characters.' })
    const salt = crypto.randomBytes(16).toString('hex')
    const now = Date.now()
    const result = await db.runTransaction(async tx => {
      const currentSnap = await tx.get(ref)
      const current = currentSnap.data() || {}
      if (!current.sensitiveKeyResetHash || !current.sensitiveKeyResetSalt || Number(current.sensitiveKeyResetExpiresAt || 0) < now) return 'expired'
      if (Number(current.sensitiveKeyResetAttempts || 0) >= 5) return 'locked'
      const valid = safeEqualHex(hashSensitiveKey(code, current.sensitiveKeyResetSalt), current.sensitiveKeyResetHash)
      if (!valid) {
        tx.set(ref, { sensitiveKeyResetAttempts: Number(current.sensitiveKeyResetAttempts || 0) + 1 }, { merge: true })
        return 'incorrect'
      }
      tx.set(ref, { sensitiveKeyHash: hashSensitiveKey(key, salt), sensitiveKeySalt: salt, sensitiveKeyUpdatedAt: now,
        sensitiveKeyResetHash: null, sensitiveKeyResetSalt: null, sensitiveKeyResetExpiresAt: null,
        sensitiveKeyResetAttempts: 0, sensitiveKeyVerifyAttempts: 0,
        sensitiveKeyVerifyLockedUntil: 0 }, { merge: true })
      return 'ok'
    })
    if (result === 'expired') return res.status(400).json({ error: 'Reset code is missing or expired.' })
    if (result === 'locked') return res.status(429).json({ error: 'Too many incorrect attempts. Request a new reset code after the cooldown.' })
    if (result === 'incorrect') return res.status(403).json({ error: 'Incorrect reset code.' })
    return res.status(200).json({ ok:true })
  }
  return res.status(400).json({ error: 'Unknown security action.' })
}

async function linkNotices(req, res) {
  const decoded = await requireOwnerLevel(req)
  const noticeId = String(req.body?.noticeId || '')
  const ids = [...new Set(Array.isArray(req.body?.linkedNoticeIds) ? req.body.linkedNoticeIds.map(String).filter(Boolean) : [])].slice(0, 20)
  if (!noticeId) return res.status(400).json({ error:'Notice ID is required.' })
  const baseSnap = await db.collection('notices').doc(noticeId).get()
  if (!baseSnap.exists) return res.status(404).json({ error:'Announcement not found.' })
  const base = baseSnap.data() || {}; const propertyId = String(base.propertyId || 'default')
  const profileSnap = await db.collection('users').doc(decoded.uid).get(); const profile = profileSnap.data() || {}
  const { isAdmin, unrestricted, allowed } = ownerScope(profile)
  if (!(isAdmin || unrestricted || allowed.has(propertyId))) return res.status(403).json({ error:'You do not have access to this announcement.' })
  const refs = ids.map(id => db.collection('notices').doc(id)); const snaps = refs.length ? await db.getAll(...refs) : []
  for (let i=0;i<snaps.length;i++) { if (!snaps[i].exists) return res.status(404).json({ error:`Linked announcement ${ids[i]} was not found.` }); const linked = snaps[i].data() || {}; if (String(linked.propertyId || 'default') !== propertyId) return res.status(403).json({ error:'Announcements can only be linked within the same apartment/property.' }) }
  await db.collection('notices').doc(noticeId).update({ linkedNoticeIds: ids, linksUpdatedAt: Date.now(), linksUpdatedBy: decoded.uid })
  return res.status(200).json({ ok:true, linkedNoticeIds:ids })
}

async function correctRentPayment(req, res) {
  const decoded = await requireOwnerLevel(req)
  const paymentId = String(req.body?.paymentId || '')
  const key = String(req.body?.criticalKey || '')
  const reason = String(req.body?.reason || '').trim()
  const replacementAmount = req.body?.replacementAmount == null || req.body?.replacementAmount === '' ? null : Number(req.body.replacementAmount)
  if (!paymentId || !key || !reason) return res.status(400).json({ error:'Payment, critical change password and reason are required.' })
  const profileSnap = await db.collection('users').doc(decoded.uid).get(); const profile = profileSnap.data() || {}
  const keyResult = await verifyCriticalKey(decoded.uid, key)
  if (keyResult === 'unconfigured') return res.status(400).json({ error:'Set the critical change password in Security Settings first.' })
  if (keyResult === 'locked') return res.status(429).json({ error:'Too many incorrect attempts. Try again in 15 minutes.' })
  if (keyResult !== 'ok') return res.status(403).json({ error:'Incorrect critical change password.' })
  const paymentRef = db.collection('rentPayments').doc(paymentId); const paymentSnap = await paymentRef.get()
  if (!paymentSnap.exists) return res.status(404).json({ error:'Payment not found.' })
  const payment = paymentSnap.data() || {}; const houseId = String(payment.houseId || '')
  const houseSnap = houseId ? await db.collection('houses').doc(houseId).get() : null
  if (!houseSnap?.exists) return res.status(404).json({ error:'House not found.' })
  const house = houseSnap.data() || {}; const { isAdmin, unrestricted, allowed } = ownerScope(profile); const propertyId = String(house.propertyId || 'default')
  if (!(isAdmin || unrestricted || allowed.has(propertyId))) return res.status(403).json({ error:'You do not have access to this house.' })
  if (payment.status !== 'approved') return res.status(400).json({ error:'Only an approved payment can be corrected here.' })
  if (replacementAmount !== null && (!Number.isFinite(replacementAmount) || replacementAmount <= 0)) return res.status(400).json({ error:'Replacement amount must be greater than zero.' })

  // Legacy rent journals do not store paymentId. Do not guess which journal
  // belongs to this payment when multiple or incomplete matches exist.
  const journalSnap = await db.collection('accountingTransactions').where('houseId','==',houseId).get()
  const original = journalSnap.docs.map(d=>({id:d.id,...d.data()})).filter(x =>
    String(x.description||'') === `Approved rent ${payment.month || ''} for ${house.internalDoorNumber || houseId}` &&
    Number(x.amount||0) === Number(payment.amount||0)
  )
  const debitLines = original.filter(line => Number(line.debit || 0) > 0 && Number(line.credit || 0) === 0)
  const creditLines = original.filter(line => Number(line.credit || 0) > 0 && Number(line.debit || 0) === 0)
  const journalIds = new Set(original.map(line => String(line.journalId || '')))
  const expectedAmount = Number(payment.amount || 0)
  const validPair = original.length === 2 && debitLines.length === 1 && creditLines.length === 1 &&
    debitLines[0].account === 'Cash / Bank' && creditLines[0].account === 'Rental Income' &&
    Number(debitLines[0].debit) === expectedAmount && Number(creditLines[0].credit) === expectedAmount &&
    journalIds.size === 1 && !journalIds.has('')
  if (!validPair) return res.status(409).json({ error:'The original rent journal is incomplete or unbalanced. No correction was made; review the accounting entries first.' })

  const correctedAt = Date.now()
  const actor = { uid:decoded.uid, name:profile.name||profile.email||'Owner' }
  const replacementId = replacementAmount !== null ? `correction-${paymentId}` : null
  const replacementRef = replacementId ? db.collection('rentPayments').doc(replacementId) : null
  const reversalRefs = original.map(line => db.collection('accountingTransactions').doc(`REV-${paymentId}-${line.id}`))
  const replacementJournalId = `CORR-J-${paymentId}`
  const replacementDebitRef = replacementAmount !== null ? db.collection('accountingTransactions').doc(`${replacementJournalId}-D`) : null
  const replacementCreditRef = replacementAmount !== null ? db.collection('accountingTransactions').doc(`${replacementJournalId}-C`) : null
  const auditRef = db.collection('auditLogs').doc(`rent-correction-${paymentId}`)

  // All reads are completed before writes. Payment status and source journal
  // lines are revalidated inside the transaction to prevent duplicate or stale
  // corrections from producing partial accounting changes.
  await db.runTransaction(async tx => {
    const currentPaymentSnap = await tx.get(paymentRef)
    const sourceSnaps = await Promise.all(original.map(line => tx.get(db.collection('accountingTransactions').doc(line.id))))
    if (!currentPaymentSnap.exists) throw Object.assign(new Error('Payment not found.'), { statusCode:404 })
    const currentPayment = currentPaymentSnap.data() || {}
    if (currentPayment.status !== 'approved') throw Object.assign(new Error('This payment has already changed or was corrected. Refresh and review its current status.'), { statusCode:409 })
    for (let i=0;i<sourceSnaps.length;i++) {
      const source = sourceSnaps[i].data() || {}
      const expectedLine = original[i]
      if (!sourceSnaps[i].exists || String(source.description||'') !== `Approved rent ${currentPayment.month || ''} for ${house.internalDoorNumber || houseId}` ||
        Number(source.amount||0) !== Number(currentPayment.amount||0) || source.journalId !== expectedLine.journalId ||
        source.account !== expectedLine.account || Number(source.debit||0) !== Number(expectedLine.debit||0) ||
        Number(source.credit||0) !== Number(expectedLine.credit||0)) {
        throw Object.assign(new Error('The original rent journal changed during correction. No changes were made; review the accounting entries.'), { statusCode:409 })
      }
    }
    const reversalData = original.map((line, i) => ({
      ...line,
      journalId:`REV-${paymentId}`,
      entryType:'journal-line',
      description:`Reversal of corrected rent payment ${paymentId}`,
      account:line.account,
      debit:Number(line.credit||0),
      credit:Number(line.debit||0),
      createdAt:correctedAt,
      updatedAt:correctedAt,
      createdBy:decoded.uid,
      reversesTransactionId:line.id,
      correctionPaymentId:paymentId
    }))
    reversalRefs.forEach((ref, i) => tx.set(ref, reversalData[i], { merge:false }))
    tx.update(paymentRef, { status:'corrected', correctedAt, correctedBy:actor, correctionReason:reason, replacementAmount, correctionReplacementId:replacementId })

    if (replacementAmount !== null) {
      tx.create(replacementRef, { ...currentPayment, amount:replacementAmount, status:'approved', approvedAt:correctedAt, submittedAt:correctedAt,
        applicationNumber:`CORR-${String(currentPayment.applicationNumber || paymentId).slice(-20)}`, actionedBy:actor,
        correctedFromPaymentId:paymentId, correctionReason:reason, correctedAt:null })
      const base = { propertyId, createdBy:decoded.uid, journalId:replacementJournalId,
        date:currentPayment.month ? `${currentPayment.month}-01` : new Date().toISOString().slice(0,10),
        description:`Corrected approved rent ${currentPayment.month || ''} for ${house.internalDoorNumber || houseId}`,
        category:'Rent', houseId, entryType:'journal-line', amount:Number(replacementAmount),
        createdAt:correctedAt, updatedAt:correctedAt, correctionPaymentId:paymentId, rentPaymentId:replacementId }
      tx.create(replacementDebitRef,{...base,account:'Cash / Bank',debit:Number(replacementAmount),credit:0})
      tx.create(replacementCreditRef,{...base,account:'Rental Income',debit:0,credit:Number(replacementAmount)})
    }
    tx.create(auditRef, { action:'rent_payment_corrected', targetId:paymentId, houseId, propertyId,
      actorUid:decoded.uid, actorEmail:decoded.email || null, reason, replacementAmount, replacementId, createdAt:correctedAt })
  })
  return res.status(200).json({ ok:true, replacementId })
}

export default async function handler(req, res) {
  try {
    const route = String(req.query?.route || '')
    if (route === 'app-config' && req.method === 'POST') return await appConfigHandler(req, res)
    if (route === 'public-notice' && req.method === 'GET') return await publicNotice(req, res)
    if (route === 'owner-houses' && req.method === 'POST') return await ownerHouses(req, res)
    if (route === 'owner-documents' && req.method === 'POST') return await ownerDocuments(req, res)
    if (route === 'pending-rent-approvals' && req.method === 'POST') return await pendingRentApprovals(req, res)
    if (route === 'sensitive-key' && req.method === 'POST') return await sensitiveKey(req, res)
    if (route === 'correct-rent-payment' && req.method === 'POST') return await correctRentPayment(req, res)
    if (route === 'link-notices' && req.method === 'POST') return await linkNotices(req, res)
    return res.status(404).json({ error: 'Route not found' })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Request failed' })
  }
}
