import { db, requireOwnerLevel } from '../lib/firebaseAdmin.js'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function propertyAllowed(profile, propertyId) {
  if (profile.role === 'admin') return true
  if (profile.role !== 'owner' || profile.appMode === 'dad-lite') return false
  if (!Object.prototype.hasOwnProperty.call(profile, 'propertyAccess')) return true
  const access = Array.isArray(profile.propertyAccess) ? profile.propertyAccess : []
  return access.includes('*') || access.includes(propertyId)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    const decoded = await requireOwnerLevel(req)
    const requestId = String(req.body?.requestId || '').trim()
    if (!requestId || requestId.length > 200) {
      return res.status(400).json({ error: 'CCTV request ID is required' })
    }

    const profileSnap = await db.collection('users').doc(decoded.uid).get()
    const profile = profileSnap.data() || {}
    const requestSnap = await db.collection('cctvFootageRequests').doc(requestId).get()
    if (!requestSnap.exists) return res.status(404).json({ error: 'CCTV request not found' })

    const record = requestSnap.data() || {}
    const propertyId = String(record.propertyId || 'default')
    if (!propertyAllowed(profile, propertyId)) {
      return res.status(403).json({ error: 'Not allowed to view this CCTV copy' })
    }

    const publicId = String(record.copyPublicId || '').trim()
    if (!publicId || !publicId.startsWith('cctv-footage/')) {
      return res.status(404).json({ error: 'Private CCTV copy not found' })
    }

    const expiresAt = Math.round(Date.now() / 1000) + 5 * 60
    const url = cloudinary.url(publicId, {
      resource_type: record.copyResourceType || 'video',
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: expiresAt,
    })

    return res.status(200).json({ url })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Unable to sign CCTV URL' })
  }
}
