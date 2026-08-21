import { auth, db, requireOwnerLevel } from '../lib/firebaseAdmin.js'

// Changing a tenant's login EMAIL has to go through the Admin SDK — a client
// can't change another user's Firebase Auth email, and just editing the
// Firestore copy would leave their actual login email out of sync. Phone
// number is Firestore-only, but bundled here so both update in one call and
// stay consistent across users/{uid}, houses/{houseId}, and customers/{id}.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const decoded = await requireOwnerLevel(req)
    const callerDoc = await db.collection('users').doc(decoded.uid).get()
    const editedBy = { uid: decoded.uid, name: callerDoc.data()?.name || 'Owner' }

    const { tenantUid, houseId, newEmail, newPhone } = req.body || {}
    if (!tenantUid || !houseId) return res.status(400).json({ error: 'Missing required fields' })

    if (newEmail) {
      await auth.updateUser(tenantUid, { email: newEmail })
    }

    const updates = { editedAt: Date.now(), editedBy }
    if (newEmail) updates.email = newEmail
    if (newPhone) updates.phone = newPhone

    await db.collection('users').doc(tenantUid).update(updates)

    const houseUpdates = { ...updates }
    if (newEmail) houseUpdates.tenantEmail = newEmail
    if (newPhone) houseUpdates.tenantPhone = newPhone
    delete houseUpdates.email
    delete houseUpdates.phone
    await db.collection('houses').doc(houseId).update(houseUpdates)

    // Keep the directory mirror in sync too, if phone visibility means it's shown there.
    const houseDoc = await db.collection('houses').doc(houseId).get()
    const house = houseDoc.data()
    await db.collection('directory').doc(houseId).set({
      internalDoorNumber: house.internalDoorNumber,
      status: house.status,
      tenantName: house.tenantName,
      tenantPhone: house.phoneVisibleToNeighbors ? house.tenantPhone : null,
      phoneVisibleToNeighbors: !!house.phoneVisibleToNeighbors,
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
