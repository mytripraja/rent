import { db, requireAuth } from '../lib/firebaseAdmin.js'

// Returns only the authenticated tenant's share; Firestore rules deliberately
// deny tenant reads of the parent bill document because rules cannot redact fields.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  try {
    const decoded = await requireAuth(req)
    const profileSnap = await db.collection('users').doc(decoded.uid).get()
    const profile = profileSnap.data() || {}
    if (profile.role !== 'tenant' || !profile.houseId) return res.status(403).json({ error: 'Tenant access required' })
    const permissions = profile.tenantPermissions || {}
    if (permissions.bills === false) return res.status(403).json({ error: 'Bill access is disabled for this account' })
    const type = String(req.body?.type || '').toLowerCase()
    if (!['water', 'eb'].includes(type)) return res.status(400).json({ error: 'Invalid bill type' })
    const collectionName = type === 'eb' ? 'ebBills' : 'waterBills'
    const snap = await db.collection(collectionName).where('houseIds', 'array-contains', profile.houseId).get()
    const bills = snap.docs.map(doc => {
      const data = doc.data() || {}
      const share = Array.isArray(data.shares) ? data.shares.find(item => String(item.houseId) === String(profile.houseId)) : null
      if (!share) return null
      return {
        id: doc.id, type, cycleLabel: String(data.cycleLabel || ''), title: String(data.cycleLabel || `${type.toUpperCase()} bill`),
        totalAmount: Number(data.totalAmount || 0), dueDate: data.dueDate || null, note: String(data.note || ''),
        createdAt: data.createdAt || null, cycleMonths: data.cycleMonths ?? null, billingMode: data.billingMode || 'shared-split',
        paymentEnabled: data.paymentEnabled !== false, consumptionUnits: data.consumptionUnits ?? null,
        previousMeterReading: data.previousMeterReading ?? null, currentMeterReading: data.currentMeterReading ?? null,
        meterReadingDate: data.meterReadingDate || null, meterReadingTime: data.meterReadingTime || null,
        // The only share sent to the browser is the caller's own share.
        shares: [{ ...share, houseId: profile.houseId }], houseIds: [profile.houseId],
        paymentDetails: data.paymentDetails && typeof data.paymentDetails === 'object' ? {
          upiId: String(data.paymentDetails.upiId || ''), payeeName: String(data.paymentDetails.payeeName || ''),
          bankName: String(data.paymentDetails.bankName || ''), accountName: String(data.paymentDetails.accountName || ''),
          accountNumber: String(data.paymentDetails.accountNumber || ''), ifsc: String(data.paymentDetails.ifsc || ''),
          paymentInstructions: String(data.paymentDetails.paymentInstructions || '')
        } : {}
      }
    }).filter(Boolean).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    return res.status(200).json({ bills })
  } catch (err) {
    console.error('Tenant utility bill lookup failed:', err)
    if (err.statusCode === 429 && err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter))
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Could not load utility bills' })
  }
}
