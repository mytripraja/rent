import { db, requireAuth } from '../lib/firebaseAdmin.js'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Deliberately a SEPARATE endpoint from get-signed-url.js rather than adding
// a branch there. That endpoint's whole job is guaranteeing Aadhaar/ration
// card documents are owner-only, full stop — mixing in tenant-accessible
// logic there risks weakening that guarantee by accident later. A rent
// agreement is different: the tenant signed it, so they should be able to
// view their own copy, just not anyone else's.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const decoded = await requireAuth(req)
    const callerDoc = await db.collection('users').doc(decoded.uid).get()
    const caller = callerDoc.data()
    const isOwnerLevel = caller?.role === 'owner' || caller?.role === 'admin'

    const { agreementId, publicId, resourceType } = req.body || {}
    if (!agreementId || !publicId) return res.status(400).json({ error: 'Missing agreementId or publicId' })

    if (!isOwnerLevel) {
      const agreementDoc = await db.collection('rentAgreements').doc(agreementId).get()
      const agreement = agreementDoc.data()
      if (!agreement || agreement.houseId !== caller?.houseId) {
        return res.status(403).json({ error: "You can only view your own house's agreement." })
      }
    }

    const expiresAt = Math.round(Date.now() / 1000) + 5 * 60 // 5 minutes
    const url = cloudinary.url(publicId, {
      resource_type: resourceType || 'image',
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: expiresAt,
    })

    res.status(200).json({ url })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
