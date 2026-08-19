const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')

initializeApp()
const auth = getAuth()
const db = getFirestore()

// When a users/{uid} doc is created with role 'owner', set a custom claim
// so Storage rules (which can't query Firestore) can check request.auth.token.role.
exports.setRoleClaim = onDocumentCreated('users/{uid}', async (event) => {
  const data = event.data.data()
  if (!data?.role) return
  await auth.setCustomUserClaims(event.params.uid, { role: data.role })
})

// Also update the claim if role ever changes (rare, but safe to have)
exports.syncRoleClaimOnUpdate = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (before?.role !== after?.role) {
    await auth.setCustomUserClaims(event.params.uid, { role: after.role })
  }
})

// Runs every 15 minutes: finds houses whose accessRevokeScheduledAt time has
// passed and disables the vacated tenant's login (they already lost currentTenantId
// in houseService.vacateHouse, this disables the Firebase Auth account itself).
exports.revokeAccessAfterVacate = onSchedule('every 15 minutes', async () => {
  const now = Date.now()
  const snap = await db
    .collection('houses')
    .where('accessRevokeScheduledAt', '<=', now)
    .where('accessRevokeScheduledAt', '>', 0)
    .get()

  for (const doc of snap.docs) {
    const house = doc.data()
    // The vacated tenant's uid is on the most recent closed history entry.
    const historySnap = await db
      .collection('houses')
      .doc(doc.id)
      .collection('history')
      .orderBy('movedInAt', 'desc')
      .limit(1)
      .get()

    if (!historySnap.empty) {
      const tenantId = historySnap.docs[0].data().tenantId
      if (tenantId) {
        await auth.updateUser(tenantId, { disabled: true }).catch(() => {})
      }
    }

    // Clear the flag so this house isn't reprocessed every 15 minutes
    await doc.ref.update({ accessRevokeScheduledAt: 0 })
  }
})

// ---- createTenantAccountAdmin ----
// Creating a Firebase Auth user with the CLIENT SDK auto-switches the active
// session to that new user — which would log the owner out mid-booking. This
// callable function uses the Admin SDK instead, so the owner's own session is
// never touched. It also mints/reuses the bank-style Customer ID and writes
// both the users/{uid} and customers/{customerId} docs.
const { HttpsError, onCall } = require('firebase-functions/v2/https')

exports.createTenantAccountAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.')
  }
  const callerDoc = await db.collection('users').doc(request.auth.uid).get()
  if (callerDoc.data()?.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only the owner can create tenant accounts.')
  }

  const { email, password, name, phone, houseId, aadhaarNumber } = request.data

  const userRecord = await auth.createUser({ email, password, displayName: name })
  await auth.setCustomUserClaims(userRecord.uid, { role: 'tenant' })

  // Reuse an existing Customer ID if this Aadhaar number already has one.
  let customerId
  if (aadhaarNumber) {
    const existing = await db
      .collection('customers')
      .where('aadhaarNumber', '==', aadhaarNumber)
      .limit(1)
      .get()
    if (!existing.empty) {
      customerId = existing.docs[0].id
      await existing.docs[0].ref.update({
        linkedUids: FieldValue.arrayUnion(userRecord.uid),
        linkedHouseIds: FieldValue.arrayUnion(houseId),
      })
    }
  }

  if (!customerId) {
    customerId = await db.runTransaction(async (tx) => {
      const counterRef = db.collection('counters').doc('customerId')
      const counterSnap = await tx.get(counterRef)
      const current = counterSnap.exists ? counterSnap.data().value : 1000
      const next = current + 1
      tx.set(counterRef, { value: next }, { merge: true })
      const id = `RM${next}`
      tx.set(db.collection('customers').doc(id), {
        customerId: id,
        name,
        phone,
        email,
        aadhaarNumber: aadhaarNumber || null,
        linkedUids: [userRecord.uid],
        linkedHouseIds: [houseId],
        createdAt: Date.now(),
      })
      tx.set(db.collection('customerLookup').doc(id), { email })
      return id
    })
  }

  await db.collection('users').doc(userRecord.uid).set({
    role: 'tenant',
    name,
    email,
    phone,
    houseId,
    customerId,
    createdAt: Date.now(),
  })

  return { uid: userRecord.uid, customerId }
})
