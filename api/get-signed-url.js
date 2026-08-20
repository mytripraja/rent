import { requireOwner } from '../lib/firebaseAdmin.js'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await requireOwner(req)

    const { publicId, resourceType } = req.body || {}
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
