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
    const allowed = new Set(Array.isArray(profile.propertyAccess) ? profile.propertyAccess.map(String) : [])
    const snap = await db.collection('houses').get()
    const houses = snap.docs
      .map(d => ({ id: d.id, ...d.data(), propertyId: d.data()?.propertyId || 'default' }))
      .filter(h => isAdmin || unrestricted || allowed.has(String(h.propertyId)))
      .sort((a, b) => String(a.internalDoorNumber || '').localeCompare(String(b.internalDoorNumber || ''), undefined, { numeric: true }))
    return res.status(200).json({ houses })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Could not load houses' })
  }
}
