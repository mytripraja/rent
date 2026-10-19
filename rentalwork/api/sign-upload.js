import { db, requireAuth, ownerCanAccessProperty, tenantPermissionEnabled } from '../lib/firebaseAdmin.js'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

async function houseAllowed(profile, houseId) {
  const snap = await db.collection('houses').doc(String(houseId || '')).get()
  if (!snap.exists) return false
  return ownerCanAccessProperty(profile, String(snap.data()?.propertyId || 'default'))
}

async function allNoticeTargetsAllowed(profile, notice) {
  const targets = notice?.targetHouseIds
  if (targets === 'all') return profile.role === 'admin' || !Object.prototype.hasOwnProperty.call(profile, 'propertyAccess') || Array.isArray(profile.propertyAccess) && profile.propertyAccess.includes('*')
  if (!Array.isArray(targets) || !targets.length) return false
  const refs = targets.slice(0, 100).map(id => db.collection('houses').doc(String(id)))
  const snaps = await db.getAll(...refs)
  return snaps.every(s => s.exists && ownerCanAccessProperty(profile, String(s.data()?.propertyId || 'default')))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    const decoded = await requireAuth(req)
    const profileSnap = await db.collection('users').doc(decoded.uid).get()
    const profile = profileSnap.data() || {}
    const isFullOwner = profile.role === 'admin' || (profile.role === 'owner' && profile.appMode !== 'dad-lite')
    const isTenant = profile.role === 'tenant'
    const requestedFolder = String(req.body?.folder || '').trim()
    let visibility = req.body?.visibility === 'authenticated' ? 'authenticated' : 'upload'
    if (!requestedFolder || requestedFolder.length > 240) return res.status(400).json({ error: 'Upload folder is required' })

    let allowed = false
    const houseMatch = requestedFolder.match(/^(rent-proofs|eb-proofs|water-proofs|maintenance)\/([^/]+)$/)
    const tenantPhotoMatch = requestedFolder.match(/^tenant-photos\/([^/]+)$/)
    const privateDocMatch = requestedFolder.match(/^private-documents\/([^/]+)$/)

    if (houseMatch) {
      const houseId = houseMatch[2]
      const folderKind = houseMatch[1]
      const tenantPermission = folderKind === 'maintenance' ? 'maintenance' : folderKind === 'rent-proofs' ? 'rentSubmit' : 'bills'
      allowed = isFullOwner ? await houseAllowed(profile, houseId) : (isTenant && profile.houseId === houseId && tenantPermissionEnabled(profile, tenantPermission))
      visibility = 'authenticated'
      if (!allowed) return res.status(403).json({ error: 'Not allowed to upload to this house' })
    } else if (tenantPhotoMatch) {
      if (!isFullOwner) return res.status(403).json({ error: 'Owner access required' })
      allowed = await houseAllowed(profile, tenantPhotoMatch[1])
    } else if (privateDocMatch) {
      visibility = 'authenticated'
      allowed = isFullOwner ? await houseAllowed(profile, privateDocMatch[1]) : (isTenant && profile.houseId === privateDocMatch[1] && tenantPermissionEnabled(profile, 'documents'))
    } else if (requestedFolder === 'agreements' || requestedFolder === 'cctv-footage' || requestedFolder === 'expenses' || requestedFolder === 'houses') {
      allowed = isFullOwner
    } else if (requestedFolder.match(/^profile-photos\/([^/]+)$/)) {
      const profileUid = requestedFolder.slice('profile-photos/'.length)
      // Profile images must be bound to the authenticated user's own UID.
      // This prevents one resident from choosing another user's profile path.
      allowed = decoded.uid === profileUid
    } else if (requestedFolder.startsWith('public-notices/')) {
      if (!isFullOwner) return res.status(403).json({ error: 'Owner access required' })
      const noticeId = requestedFolder.slice('public-notices/'.length)
      const noticeSnap = await db.collection('notices').doc(noticeId).get()
      if (!noticeSnap.exists) return res.status(404).json({ error: 'Announcement not found' })
      allowed = await allNoticeTargetsAllowed(profile, noticeSnap.data() || {})
    } else {
      return res.status(400).json({ error: 'Unsupported upload folder' })
    }

    if (!allowed) return res.status(403).json({ error: 'Upload not allowed' })

    const timestamp = Math.round(Date.now() / 1000)
    const paramsToSign = { timestamp, folder: requestedFolder, type: visibility }
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET)
    return res.status(200).json({ signature, timestamp, type: visibility, apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Could not sign upload' })
  }
}
