import { db, requireDadLite } from '../lib/firebaseAdmin.js'

function monthOk(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    await requireDadLite(req)
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const month = String(body.month || '').trim()
    if (!monthOk(month)) return res.status(400).json({ error: 'Invalid month' })

    // Keep this query deliberately simple: Dad Lite only needs the current
    // occupied roster, and Admin SDK access bypasses client Firestore rules.
    // We normalize the status below so older records using 'Occupied' still work.
    const housesSnap = await db.collection('houses').get()
    const houses = housesSnap.docs.map(d => {
      const h = d.data()
      const status = String(h.status || '').trim().toLowerCase()
      if (status !== 'occupied') return null
      return {
        id: d.id,
        internalDoorNumber: h.internalDoorNumber || '',
        govtDoorNumber: h.govtDoorNumber || '',
        tenantName: h.tenantName || 'Tenant',
        rentAmount: Number(h.rentAmount || 0),
        currentTenantId: h.currentTenantId || null,
      }
    }).filter(Boolean)

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
    console.error('dad-lite-roster:', err)
    const status = err.statusCode || 500
    let message = err.message || 'Unable to load rent roster'
    if (status === 500 && /FIREBASE_SERVICE_ACCOUNT_KEY|credential|private key/i.test(message)) {
      message = 'Dad Lite service is not connected to Firebase Admin. Check FIREBASE_SERVICE_ACCOUNT_KEY in the Vercel Production environment.'
    }
    return res.status(status).json({ error: message, code: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'ROSTER_LOAD_FAILED' })
  }
}
