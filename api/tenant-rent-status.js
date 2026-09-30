import { db, requireAuth } from '../lib/firebaseAdmin.js'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function resolveStatus(payments) {
  if (payments.some((p) => p.status === 'approved')) return 'paid'
  if (payments.some((p) => p.status === 'waiting_approval')) return 'waiting_approval'
  if (payments.some((p) => p.status === 'rejected')) return 'rejected'
  return 'not_paid'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const decoded = await requireAuth(req)
    const userSnap = await db.collection('users').doc(decoded.uid).get()
    const user = userSnap.data() || {}
    if (user.role !== 'tenant') return res.status(403).json({ error: 'Tenant access required' })

    const houseId = String(user.houseId || '').trim()
    if (!houseId) return res.status(404).json({ error: 'House not linked' })
    const houseSnap = await db.collection('houses').doc(houseId).get()
    if (!houseSnap.exists) return res.status(404).json({ error: 'House not found' })
    const house = houseSnap.data() || {}

    if (req.body?.action === 'house') {
      // Deliberately whitelist resident-safe fields. Never return rent/advance
      // or owner notes unless the caller has rent-details permission.
      const canSeeRentDetails = user.tenantPermissions?.rent !== false && user.tenantPermissions?.rentDetails !== false
      return res.status(200).json({
        house: {
          id: houseId,
          propertyId: house.propertyId || 'default',
          internalDoorNumber: house.internalDoorNumber || '',
          govtDoorNumber: house.govtDoorNumber || '',
          floor: house.floor || '',
          status: house.status || '',
          tenantName: house.tenantName || '',
          phoneVisibleToNeighbors: !!house.phoneVisibleToNeighbors,
          blueprintVisibleToTenants: !!house.blueprintVisibleToTenants,
          photos: Array.isArray(house.photos) ? house.photos : [],
          ...(canSeeRentDetails ? { rentAmount: Number(house.rentAmount || 0), pendingRentAmount: house.pendingRentAmount || null, pendingRentEffectiveMonth: house.pendingRentEffectiveMonth || null } : {}),
        },
      })
    }

    if (user.tenantPermissions?.rent === false || user.tenantPermissions?.rentStatus === false) {
      return res.status(403).json({ error: 'Rent status access is disabled' })
    }

    const month = String(req.body?.month || currentMonth()).slice(0, 7)
    const snap = await db.collection('rentPayments').where('houseId', '==', houseId).get()
    const payments = snap.docs.map((d) => d.data()).filter((p) => p.month === month)
    return res.status(200).json({ month, status: resolveStatus(payments) })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Could not load rent status' })
  }
}
