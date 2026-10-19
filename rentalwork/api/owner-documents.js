import { db, requireOwnerLevel } from '../lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    const decoded = await requireOwnerLevel(req)
    const profileSnap = await db.collection('users').doc(decoded.uid).get()
    const profile = profileSnap.data() || {}
    const isAdmin = profile.role === 'admin'
    const unrestricted = profile.role === 'owner' && profile.appMode !== 'dad-lite' && (
      !Object.prototype.hasOwnProperty.call(profile, 'propertyAccess')
      || (Array.isArray(profile.propertyAccess) && profile.propertyAccess.includes('*'))
    )
    if (!isAdmin && !unrestricted && profile.role !== 'owner') return res.status(403).json({ error: 'Owner access required' })

    const houseSnap = await db.collection('houses').get()
    const allowedProperties = new Set(Array.isArray(profile.propertyAccess) ? profile.propertyAccess.map(String) : [])
    const houses = houseSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(h => isAdmin || unrestricted || allowedProperties.has(String(h.propertyId || 'default')))
      .sort((a, b) => String(a.internalDoorNumber || '').localeCompare(String(b.internalDoorNumber || ''), undefined, { numeric: true }))
    const houseIds = new Set(houses.map(h => h.id))

    const docSnap = await db.collection('documents').get()
    const documents = docSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => houseIds.has(String(d.houseId || '')))
      .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0))

    return res.status(200).json({ houses, documents })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Could not load documents' })
  }
}
