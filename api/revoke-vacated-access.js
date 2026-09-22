import { auth, db, getBackupBucket } from '../lib/firebaseAdmin.js'

// Sweeps for houses past their vacate-access-revoke window and disables that
// tenant's login. Called by GitHub Actions on a schedule (see
// .github/workflows/revoke-access.yml) since Vercel's free-tier cron only
// runs once a day, which isn't precise enough for a 1-hour window.
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Shared-secret auth, not a user token — this is called by a scheduler, not a person.
  const providedSecret = req.headers['x-cron-secret']
  if (!process.env.REVOKE_CRON_SECRET || providedSecret !== process.env.REVOKE_CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.query?.job === 'maintenance') {
      const snap = await db.collection('preventiveMaintenance').where('autoCreate', '==', true).get()
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const today = now.toISOString().slice(0, 10)
      const created = []
      for (const itemDoc of snap.docs) {
        const item = itemDoc.data()
        if (!item.nextRun || item.nextRun > today) continue
        const dueDate = item.nextRun
        const houseSnap = item.houseId ? await db.collection('houses').doc(item.houseId).get() : null
        const house = houseSnap?.exists ? houseSnap.data() : null
        const workRef = await db.collection('maintenanceWorkOrders').add({
          propertyId: item.propertyId || 'default',
          houseId: item.houseId || null,
          tenantId: house?.currentTenantId || null,
          title: item.title || `Preventive maintenance: ${item.asset || 'Scheduled service'}`,
          asset: item.asset || null,
          preventive: true,
          preventiveScheduleId: itemDoc.id,
          priority: item.priority || 'medium',
          status: 'open',
          dueDate,
          vendor: item.vendor || null,
          createdAt: Date.now(),
          source: 'preventive-scheduler'
        })
        const base = new Date(`${dueDate}T00:00:00+05:30`)
        base.setDate(base.getDate() + Math.max(1, Number(item.frequencyDays || 30)))
        const nextRun = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`
        await itemDoc.ref.update({ lastRun: dueDate, nextRun, lastWorkOrderId: workRef.id, updatedAt: Date.now() })
        if (house?.currentTenantId) {
          await db.collection('notifications').add({ recipientId: house.currentTenantId, recipientType: 'tenant', type: 'maintenance', title: 'Maintenance scheduled', message: `${item.asset || 'Property maintenance'} is due on ${dueDate}.`, read: false, createdAt: Date.now(), metadata: { propertyId: item.propertyId || 'default', workOrderId: workRef.id } })
        }
        created.push(workRef.id)
      }
      return res.status(200).json({ job:'maintenance', checked:snap.size, created })
    }

    if (req.query?.job === 'backup') {
      const collections = ['users','properties','houses','accountingTransactions','maintenanceWorkOrders','preventiveMaintenance','purchaseOrders','inventoryItems','securityEvents','parcels','documentRegistry','leaseRecords','utilityBills','ownerInvestments','communicationMessages','societyHierarchy','backupPlans','apiIntegrations','rentPayments','notifications','activityLog']
      const data = { exportedAt: new Date().toISOString(), schemaVersion: '8.1', collections: {} }
      for (const name of collections) {
        const snap = await db.collection(name).get()
        data.collections[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const path = `rental-manager/backups/backup-${stamp}.json`
      const bucket = getBackupBucket()
      await bucket.file(path).save(JSON.stringify(data), { resumable: false, contentType: 'application/json', metadata: { cacheControl: 'private, no-store' } })
      await db.collection('backupPlans').add({ propertyId: 'system', name: `Automated backup ${stamp}`, status: 'completed', scope: 'system', storagePath: path, createdAt: Date.now() })
      return res.status(200).json({ job: 'backup', path, collections: collections.length })
    }

    if (req.query?.job === 'operations') {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const today = now.toISOString().slice(0, 10)
      const soon = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)
      const owners = []
      for (const role of ['owner', 'admin']) {
        const snap = await db.collection('users').where('role', '==', role).get()
        snap.docs.forEach(d => owners.push({ id: d.id, ...d.data() }))
      }
      const canReceive = (u, propertyId) => u.role === 'admin' || !Array.isArray(u.propertyAccess) || u.propertyAccess.includes('*') || u.propertyAccess.includes(propertyId)
      const sent = []
      const notifyOnce = async (key, recipientId, payload) => {
        const ref = db.collection('scheduledNotificationRuns').doc(key)
        if ((await ref.get()).exists) return false
        await db.collection('notifications').add({ recipientId, recipientType: 'owner', read: false, createdAt: Date.now(), ...payload })
        await ref.set({ sentAt: Date.now() })
        return true
      }
      const docsSnap = await db.collection('documentRegistry').get()
      for (const d of docsSnap.docs) {
        const item = d.data()
        if (!item.expiryDate || item.expiryDate < today || item.expiryDate > soon) continue
        for (const owner of owners.filter(u => canReceive(u, item.propertyId || 'default'))) {
          if (await notifyOnce(`doc-expiry-${d.id}-${owner.id}`, owner.id, { type: 'general', title: 'Document expiry reminder', message: `${item.name || 'A document'} expires on ${item.expiryDate}.`, metadata: { propertyId: item.propertyId || 'default', documentId: d.id } })) sent.push(d.id)
        }
      }
      const leaseSnap = await db.collection('leaseRecords').get()
      for (const d of leaseSnap.docs) {
        const item = d.data()
        if (!item.endDate || item.endDate < today || item.endDate > soon) continue
        for (const owner of owners.filter(u => canReceive(u, item.propertyId || 'default'))) {
          if (await notifyOnce(`lease-expiry-${d.id}-${owner.id}`, owner.id, { type: 'general', title: 'Lease expiry reminder', message: `Lease for ${item.tenantName || 'a tenant'} ends on ${item.endDate}.`, metadata: { propertyId: item.propertyId || 'default', leaseId: d.id } })) sent.push(d.id)
        }
      }
      const stockSnap = await db.collection('inventoryItems').get()
      for (const d of stockSnap.docs) {
        const item = d.data()
        if (Number(item.quantity || 0) > Number(item.reorderLevel || 0)) continue
        for (const owner of owners.filter(u => canReceive(u, item.propertyId || 'default'))) {
          if (await notifyOnce(`inventory-low-${d.id}-${owner.id}-${today}`, owner.id, { type: 'general', title: 'Low inventory', message: `${item.name || 'An inventory item'} is at or below its reorder level.`, metadata: { propertyId: item.propertyId || 'default', inventoryId: d.id } })) sent.push(d.id)
        }
      }
      return res.status(200).json({ job: 'operations', sent })
    }

    if (req.query?.job === 'rent-reminders') {
      const rulesSnap = await db.collection('rentReminderRules').get()
      const rules = rulesSnap.docs.map(d => ({ id:d.id, ...d.data() }))
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
      const day = now.getDate()
      const hour = now.getHours()
      const sent = []
      for (const rule of rules.filter(r => r.enabled !== false)) {
        const [rh, rm] = String(rule.time || '09:00').split(':').map(Number)
        if (Number(rule.dayOfMonth) !== day || Number(rh) !== hour) continue
        const houseSnap = await db.collection('houses').doc(rule.houseId).get()
        if (!houseSnap.exists) continue
        const house = houseSnap.data()
        if (house.status !== 'occupied' || !house.currentTenantId) continue
        const paymentSnap = await db.collection('rentPayments').where('houseId','==',rule.houseId).where('month','==',month).where('status','==','approved').limit(1).get()
        if (!paymentSnap.empty) continue
        const dedupeId = `${rule.id || rule.houseId}_${month}`
        const dedupeRef = db.collection('scheduledNotificationRuns').doc(dedupeId)
        const dedupeSnap = await dedupeRef.get()
        if (dedupeSnap.exists) continue
        await db.collection('notifications').add({ recipientId: house.currentTenantId, recipientType:'tenant', type:'payment_reminder', title:'Rent reminder', message:`Your rent for ${month} is still not marked as paid. Please submit your payment when ready.`, read:false, createdAt:Date.now(), metadata:{houseId:rule.houseId, month, scheduledRuleId:rule.id || rule.houseId} })
        await dedupeRef.set({ ruleId:rule.id || rule.houseId, houseId:rule.houseId, month, sentAt:Date.now() })
        sent.push(rule.houseId)
      }
      return res.status(200).json({ job:'rent-reminders', checked:rules.length, sent })
    }

    const now = Date.now()
    const snap = await db
      .collection('houses')
      .where('accessRevokeScheduledAt', '<=', now)
      .where('accessRevokeScheduledAt', '>', 0)
      .get()

    let revoked = 0

    for (const houseDoc of snap.docs) {
      const historySnap = await db
        .collection('houses')
        .doc(houseDoc.id)
        .collection('history')
        .orderBy('movedInAt', 'desc')
        .limit(1)
        .get()

      if (!historySnap.empty) {
        const tenantId = historySnap.docs[0].data().tenantId
        if (tenantId) {
          await auth.updateUser(tenantId, { disabled: true }).catch(() => {})
          revoked++
        }
      }

      // Family sub-accounts belong to the household, so their access is also
      // disabled when the household moves out. Their records stay in Firestore
      // for audit/history but they cannot log back into the old house.
      const familySnap = await db.collection('users')
        .where('houseId', '==', houseDoc.id)
        .where('accountType', '==', 'sub')
        .get()
      for (const familyDoc of familySnap.docs) {
        await auth.updateUser(familyDoc.id, { disabled: true }).catch(() => {})
        await familyDoc.ref.update({ disabled: true })
        revoked++
      }

      await houseDoc.ref.update({ accessRevokeScheduledAt: 0, familyAccountCount: 0 })
    }

    res.status(200).json({ checked: snap.size, revoked })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
