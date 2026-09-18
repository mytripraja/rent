import { db, requireDadLite } from '../lib/firebaseAdmin.js'

function monthOk(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    await requireDadLite(req)
    const month = String(req.body?.month || '').trim()
    if (!monthOk(month)) return res.status(400).json({ error: 'Invalid month' })

    const housesSnap = await db.collection('houses').where('status', '==', 'occupied').get()
    const houses = housesSnap.docs.map(d => {
      const h = d.data()
      return {
        id: d.id,
        internalDoorNumber: h.internalDoorNumber || '',
        govtDoorNumber: h.govtDoorNumber || '',
        tenantName: h.tenantName || 'Tenant',
        rentAmount: Number(h.rentAmount || 0),
        currentTenantId: h.currentTenantId || null,
      }
    })

    if (!houses.length) return res.status(200).json({ houses: [], payments: [] })

    const paymentsSnap = await db.collection('rentPayments').where('month', '==', month).get()
    const allowedHouseIds = new Set(houses.map(h => h.id))
    const payments = paymentsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => allowedHouseIds.has(p.houseId))
      .map(p => ({
        id: p.id,
        houseId: p.houseId,
        status: p.status,
        dateSent: p.dateSent || null,
        cashReceivedBy: p.cashReceivedBy || null,
        submittedAt: p.submittedAt || 0,
        entrySource: p.entrySource || null,
      }))

    return res.status(200).json({ houses, payments })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Unable to load rent roster' })
  }
}
