import { db } from '../lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const type = String(req.query?.type || '').toLowerCase()
    const id = String(req.query?.id || '').trim()
    const token = String(req.query?.token || '').trim()
    const details = req.query?.details === '1'
    const requestedPayment = req.query?.pay === '1'
    if (!['water', 'eb'].includes(type) || !id || !token || id.length > 160 || token.length > 200) return res.status(400).json({ error: 'Invalid bill link' })
    const collectionName = type === 'eb' ? 'ebBills' : 'waterBills'
    const snap = await db.collection(collectionName).doc(id).get()
    if (!snap.exists) return res.status(404).json({ error: 'Bill not found' })
    const data = snap.data() || {}
    if (!data.publicShareToken || data.publicShareToken !== token) return res.status(404).json({ error: 'This bill link is invalid or has been replaced' })
    const result = {
      id: snap.id,
      type,
      title: data.cycleLabel || `${type.toUpperCase()} bill`,
      totalAmount: Number(data.totalAmount || 0),
      dueDate: data.dueDate || null,
      note: String(data.note || ''),
      createdAt: data.createdAt || null,
      cycleMonths: data.cycleMonths ?? null,
      billingMode: data.billingMode || 'shared-split',
      paymentEnabled: data.paymentEnabled !== false,
      consumptionUnits: data.consumptionUnits ?? null,
      previousMeterReading: data.previousMeterReading ?? null,
      currentMeterReading: data.currentMeterReading ?? null,
      meterReadingDate: data.meterReadingDate || null,
      meterReadingTime: data.meterReadingTime || null,
    }
    if (details) {
      const shares = Array.isArray(data.shares) ? data.shares.slice(0, 200) : []
      const houseSnaps = shares.length ? await db.getAll(...shares.map(s => db.collection('houses').doc(String(s.houseId || '')))) : []
      const houseById = new Map(houseSnaps.filter(h => h.exists).map(h => [h.id, h.data() || {}]))
      result.shares = shares.map(s => {
        const h = houseById.get(String(s.houseId || '')) || {}
        return {
          houseId: String(s.houseId || ''),
          houseLabel: String(s.internalDoorNumber || h.internalDoorNumber || h.govtDoorNumber || s.houseId || 'House'),
          residentName: String(h.tenantName || h.currentTenantName || h.name || 'Resident'),
          shareAmount: Number(s.shareAmount || 0),
          monthsOccupied: s.monthsOccupied ?? null,
          consumptionUnits: s.consumptionUnits ?? null,
          previousMeterReading: s.previousMeterReading ?? null,
          currentMeterReading: s.currentMeterReading ?? null,
        }
      })
    }
    const showPayment = requestedPayment && data.paymentEnabled !== false
    if (showPayment) {
      const p = data.paymentDetails || {}
      result.paymentDetails = {
        upiId: String(p.upiId || ''),
        payeeName: String(p.payeeName || ''),
        bankName: String(p.bankName || ''),
        accountName: String(p.accountName || ''),
        accountNumber: String(p.accountNumber || ''),
        ifsc: String(p.ifsc || ''),
        paymentInstructions: String(p.paymentInstructions || ''),
      }
    }
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    return res.status(200).json({ bill: result, showPayment, details })
  } catch (err) {
    console.error('Public bill lookup failed:', err)
    return res.status(500).json({ error: 'Could not load this bill' })
  }
}
