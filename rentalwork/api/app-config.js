import { db, requireAuth } from '../lib/firebaseAdmin.js'

const DEFAULTS = {
  cashReceivers: ['Deepu', 'Rajavel', 'Siva', 'Hemalathe'],
  apartmentName: 'Rental Manager',
  apartmentAddress: '',
  dueDate: 5,
  gracePeriod: 3,
  penaltyPerDay: 100,
  upiId: '',
  ownerName: '',
  paymentModes: ['upi', 'cash', 'bank_transfer'],
  lateFeeType: 'flat',
  lateFeeAmount: 500,
  lateFeeGraceDays: 5,
  wasteSchedule: { monday: 'dry', tuesday: 'wet', wednesday: 'mixed', thursday: 'none', friday: 'dry', saturday: 'wet', sunday: 'none' },
}

function cleanConfig(data) {
  return {
    cashReceivers: Array.isArray(data.cashReceivers) ? data.cashReceivers.slice(0, 50) : DEFAULTS.cashReceivers,
    apartmentName: data.apartmentName || DEFAULTS.apartmentName,
    apartmentAddress: data.apartmentAddress || DEFAULTS.apartmentAddress,
    dueDate: Number.isFinite(Number(data.dueDate)) ? Number(data.dueDate) : DEFAULTS.dueDate,
    gracePeriod: Number.isFinite(Number(data.gracePeriod)) ? Number(data.gracePeriod) : DEFAULTS.gracePeriod,
    penaltyPerDay: Number.isFinite(Number(data.penaltyPerDay)) ? Number(data.penaltyPerDay) : DEFAULTS.penaltyPerDay,
    upiId: data.upiId || DEFAULTS.upiId,
    ownerName: data.ownerName || DEFAULTS.ownerName,
    paymentModes: Array.isArray(data.paymentModes) ? data.paymentModes.slice(0, 10) : DEFAULTS.paymentModes,
    lateFeeType: data.lateFeeType || DEFAULTS.lateFeeType,
    lateFeeAmount: Number.isFinite(Number(data.lateFeeAmount)) ? Number(data.lateFeeAmount) : DEFAULTS.lateFeeAmount,
    lateFeeGraceDays: Number.isFinite(Number(data.lateFeeGraceDays)) ? Number(data.lateFeeGraceDays) : DEFAULTS.lateFeeGraceDays,
    wasteSchedule: data.wasteSchedule || DEFAULTS.wasteSchedule,
    messageTemplates: Array.isArray(data.messageTemplates) ? data.messageTemplates.slice(0, 50) : undefined,
    properties: Array.isArray(data.properties) ? data.properties : [],
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    const decoded = await requireAuth(req)
    const userSnap = await db.collection('users').doc(decoded.uid).get()
    const user = userSnap.data() || {}
    const configSnap = await db.collection('appConfig').doc('general').get()
    const data = cleanConfig(configSnap.exists ? configSnap.data() || {} : {})

    const isAdmin = user.role === 'admin'
    const isOwner = user.role === 'owner' && user.appMode !== 'dad-lite'
    const unrestricted = !Object.prototype.hasOwnProperty.call(user, 'propertyAccess')
      || (Array.isArray(user.propertyAccess) && user.propertyAccess.includes('*'))

    // Recovery for apartments created before the property registry became the
    // canonical source of the switcher.  An older release could create houses
    // with a propertyId while the corresponding appConfig.properties entry was
    // later missing.  Admin/unrestricted owners may safely discover those
    // property IDs from the houses collection and restore a minimal registry
    // entry. Restricted owners are never allowed to enumerate this fallback.
    if ((isAdmin || (isOwner && unrestricted)) && Array.isArray(data.properties)) {
      const known = new Map(data.properties.map((item) => [String(item.id || 'default'), item]))
      const [houseSnap, legacyPropertySnap] = await Promise.all([db.collection('houses').get(), db.collection('properties').get()])
      const legacyNames = new Map(legacyPropertySnap.docs.map(doc => [String(doc.id), doc.data() || {}]))
      const discovered = new Set([...legacyNames.keys()].filter(id => id !== 'default' && !known.has(id)))
      houseSnap.docs.forEach((d) => {
        const propertyId = String(d.data()?.propertyId || 'default')
        if (propertyId !== 'default' && !known.has(propertyId)) discovered.add(propertyId)
      })
      if (discovered.size) {
        const recovered = [...discovered].map((id) => ({
          id,
          name: String(legacyNames.get(id)?.name || legacyNames.get(id)?.apartmentName || `Recovered Apartment (${id})`),
          address: String(legacyNames.get(id)?.address || ''),
          recoveredAt: Date.now(),
        }))
        const nextProperties = [...data.properties, ...recovered]
        await db.collection('appConfig').doc('general').set({ properties: nextProperties, updatedAt: Date.now() }, { merge: true })
        data.properties = nextProperties
      }
    }

    if (req.body?.action === 'reminder-list') {
      if (!(isAdmin || isOwner)) return res.status(403).json({ error: 'Owner access required' })
      const snap = await db.collection('rentReminderRules').get()
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      if (isAdmin || unrestricted) return res.status(200).json(rows)
      const allowed = new Set(Array.isArray(user.propertyAccess) ? user.propertyAccess.map(String) : [])
      return res.status(200).json(rows.filter((row) => allowed.has(String(row.propertyId || 'default'))))
    }

    if (req.body?.action === 'reminder-update') {
      if (!(isAdmin || isOwner)) return res.status(403).json({ error: 'Owner access required' })
      if (!Array.isArray(req.body?.rules)) return res.status(400).json({ error: 'Reminder rules must be an array' })
      const incoming = req.body.rules.slice(0, 500).map((rule) => ({ ...rule, propertyId: String(rule.propertyId || 'default') }))
      const ref = db.collection('rentReminderRules')
      if (isAdmin || unrestricted) {
        const existing = await ref.get()
        const batch = db.batch()
        existing.docs.forEach((d) => batch.delete(d.ref))
        incoming.forEach((rule) => batch.set(ref.doc(String(rule.id || `rent-${rule.houseId}`)), { ...rule, updatedAt: Date.now() }))
        await batch.commit()
        return res.status(200).json(incoming)
      }
      const allowed = new Set(Array.isArray(user.propertyAccess) ? user.propertyAccess.map(String) : [])
      if (incoming.some((rule) => !allowed.has(String(rule.propertyId || 'default')))) {
        return res.status(403).json({ error: 'A reminder rule belongs to an apartment outside your assigned access.' })
      }
      const existing = await ref.get()
      const batch = db.batch()
      for (const d of existing.docs) {
        const row = d.data() || {}
        if (allowed.has(String(row.propertyId || 'default'))) batch.delete(d.ref)
      }
      incoming.forEach((rule) => batch.set(ref.doc(String(rule.id || `rent-${rule.houseId}`)), { ...rule, updatedAt: Date.now() }))
      await batch.commit()
      return res.status(200).json(incoming)
    }

    if (req.body?.action === 'update') {
      if (!(isAdmin || isOwner)) return res.status(403).json({ error: 'Owner access required' })
      const fields = req.body?.fields && typeof req.body.fields === 'object' ? req.body.fields : null
      if (!fields) return res.status(400).json({ error: 'Configuration fields are required' })

      // The client no longer writes appConfig directly. Admins and unrestricted
      // owners may update the management configuration; restricted co-owners
      // may update only the apartment records they are assigned to.
      if (!(isAdmin || unrestricted)) {
        const keys = Object.keys(fields)
        if (keys.some((key) => key !== 'properties')) {
          return res.status(403).json({ error: 'Restricted owners can only update assigned apartment details.' })
        }
        if (!Array.isArray(fields.properties)) return res.status(400).json({ error: 'Properties must be an array' })
        const allowed = new Set(Array.isArray(user.propertyAccess) ? user.propertyAccess.map(String) : [])
        const existing = Array.isArray(data.properties) ? data.properties : []
        const incoming = fields.properties
        const existingById = new Map(existing.map((item) => [String(item.id || 'default'), item]))
        const next = existing.map((item) => {
          const id = String(item.id || 'default')
          const replacement = incoming.find((candidate) => String(candidate?.id || 'default') === id)
          if (!replacement || !allowed.has(id)) return item
          return { ...item, ...replacement, id: item.id || replacement.id }
        })
        for (const item of incoming) {
          const id = String(item?.id || 'default')
          if (!existingById.has(id) && allowed.has(id)) next.push({ ...item, id })
        }
        await db.collection('appConfig').doc('general').set({ properties: next, updatedAt: Date.now() }, { merge: true })
        return res.status(200).json(cleanConfig({ ...data, properties: next }))
      }

      const safeFields = { ...fields }
      delete safeFields.updatedAt
      await db.collection('appConfig').doc('general').set({ ...safeFields, updatedAt: Date.now() }, { merge: true })
      const updated = await db.collection('appConfig').doc('general').get()
      return res.status(200).json(cleanConfig(updated.data() || {}))
    }

    if (isAdmin || (isOwner && unrestricted)) {
      return res.status(200).json(data)
    }

    let allowedPropertyIds = []
    if (isOwner) {
      allowedPropertyIds = Array.isArray(user.propertyAccess) ? user.propertyAccess.map(String) : []
    } else if (user.role === 'tenant') {
      const houseId = String(user.houseId || '')
      if (houseId) {
        const houseSnap = await db.collection('houses').doc(houseId).get()
        if (houseSnap.exists) allowedPropertyIds = [String(houseSnap.data()?.propertyId || 'default')]
      }
    }

    const properties = data.properties.filter((p) => allowedPropertyIds.includes(String(p.id || 'default')))
    const fallbackProperty = properties[0] || {
      id: allowedPropertyIds[0] || 'default',
      name: data.apartmentName,
      address: data.apartmentAddress,
    }

    // Scoped users must never receive the rest of the global configuration
    // (UPI, cash receivers, late-fee policy, templates, etc.). Only expose the
    // property identity they are actually allowed to see plus the non-sensitive
    // waste schedule used by the resident UI.
    return res.status(200).json({
      apartmentName: fallbackProperty.name || data.apartmentName,
      apartmentAddress: fallbackProperty.address || data.apartmentAddress,
      wasteSchedule: data.wasteSchedule,
      properties: [fallbackProperty, ...properties.filter((p) => String(p.id || 'default') !== String(fallbackProperty.id))],
    })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Could not load app configuration' })
  }
}
