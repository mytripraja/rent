const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
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
