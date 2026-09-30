import { db, requireOwnerLevel } from '../lib/firebaseAdmin.js'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  try {
    const decoded = await requireOwnerLevel(req)

    const { documentId, proofCollection, proofId } = req.body || {}
    const profileSnap = await db.collection('users').doc(decoded.uid).get()
    const profile = profileSnap.data() || {}
    const isAdmin = profile.role === 'admin'
    const unrestrictedOwner = profile.role === 'owner' && profile.appMode !== 'dad-lite' && !Object.prototype.hasOwnProperty.call(profile, 'propertyAccess')
    const allProperties = Array.isArray(profile.propertyAccess) && profile.propertyAccess.includes('*')

    if (proofCollection && proofId) {
      if (!['rentPayments', 'ebBillPayments', 'waterBillPayments'].includes(proofCollection)) {
        return res.status(400).json({ error: 'Unsupported proof collection' })
      }
      if (typeof proofId !== 'string' || proofId.length > 200) return res.status(400).json({ error: 'Invalid proof ID' })
      const paymentSnap = await db.collection(proofCollection).doc(proofId).get()
      if (!paymentSnap.exists) return res.status(404).json({ error: 'Payment proof not found' })
      const payment = paymentSnap.data() || {}
      if (!payment.proofPublicId) {
        // Legacy payments may still contain a public proofUrl. Do not mint a
        // new public URL here; the legacy link remains visible only where the
        // existing record already exposes it.
        return res.status(404).json({ error: 'Private proof not available for this payment' })
      }
      const houseSnap = await db.collection('houses').doc(String(payment.houseId || '')).get()
      if (!houseSnap.exists) return res.status(404).json({ error: 'Payment house not found' })
      const house = houseSnap.data() || {}
      const propertyId = String(house.propertyId || 'default')
      const propertyAllowed = isAdmin || unrestrictedOwner || allProperties
        || (Array.isArray(profile.propertyAccess) && profile.propertyAccess.includes(propertyId))
      if (!propertyAllowed) return res.status(403).json({ error: 'Not allowed to view this payment proof' })
      const expectedPrefix = `${proofCollection === 'rentPayments' ? 'rent-proofs' : proofCollection === 'ebBillPayments' ? 'eb-proofs' : 'water-proofs'}/${payment.houseId}/`
      if (!String(payment.proofPublicId).startsWith(expectedPrefix)) return res.status(403).json({ error: 'Invalid proof asset' })
      const expiresAt = Math.round(Date.now() / 1000) + 5 * 60
      const url = cloudinary.url(payment.proofPublicId, { resource_type: payment.proofResourceType || 'image', type: 'authenticated', sign_url: true, secure: true, expires_at: expiresAt })
      return res.status(200).json({ url })
    }

    if (!documentId || typeof documentId !== 'string' || documentId.length > 200) {
      return res.status(400).json({ error: 'Document ID is required' })
    }

    const documentSnap = await db.collection('documents').doc(documentId).get()
    if (!documentSnap.exists) return res.status(404).json({ error: 'Document not found' })
    const document = documentSnap.data() || {}
    const houseId = String(document.houseId || '').trim()
    if (!houseId || !document.publicId) return res.status(404).json({ error: 'Document file not found' })

    const houseSnap = await db.collection('houses').doc(houseId).get()
    if (!houseSnap.exists) return res.status(404).json({ error: 'Document house not found' })
    const house = houseSnap.data() || {}
    const propertyId = house.propertyId || 'default'
    const propertyAllowed = isAdmin || unrestrictedOwner || allProperties
      || (Array.isArray(profile.propertyAccess) && profile.propertyAccess.includes(propertyId))
    if (!propertyAllowed) return res.status(403).json({ error: 'Not allowed to view this document' })

    const expectedPrefix = `private-documents/${houseId}/`
    if (!String(document.publicId).startsWith(expectedPrefix)) {
      return res.status(403).json({ error: 'Invalid document asset' })
    }

    const expiresAt = Math.round(Date.now() / 1000) + 5 * 60 // 5 minutes
    const url = cloudinary.url(document.publicId, {
      resource_type: document.resourceType || 'image',
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
