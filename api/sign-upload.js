import { requireAuth } from '../lib/firebaseAdmin.js'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Any signed-in user (owner or tenant) can request a signature — a tenant needs
// this to upload their own document. The upload itself is stored with
// type: 'authenticated', so having a signature to upload does NOT grant the
// ability to view it later; only get-signed-url.js (owner-only) can do that.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await requireAuth(req)

    const { folder } = req.body || {}
    const timestamp = Math.round(Date.now() / 1000)
    const paramsToSign = { timestamp, folder, type: 'authenticated' }
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET)

    res.status(200).json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
