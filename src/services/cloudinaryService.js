import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

// ---- Unsigned uploads ----
// Used for rent/EB payment proof screenshots. These were already readable by
// any signed-in user under the old Firebase Storage rules, so an unsigned
// Cloudinary preset (the file is reachable by its own URL, but that URL is
// never listed or guessable) keeps the same practical exposure level.
// Set this preset in Cloudinary console → Settings → Upload → Add upload preset
// → Signing mode: Unsigned.
export async function uploadUnsigned(file, folder) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', folder)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return { url: data.secure_url, publicId: data.public_id }
}

// ---- Signed private uploads ----
// Used for Aadhaar/ration card. The upload is signed by a Cloud Function
// (so your Cloudinary API secret never reaches the browser) and stored with
// Cloudinary's 'authenticated' delivery type — meaning the resulting file is
// NOT reachable by a plain URL at all, signed or not, to anyone but you.
export async function uploadPrivate(file, folder) {
  const getSignature = httpsCallable(functions, 'getCloudinarySignature')
  const { data: sig } = await getSignature({ folder })

  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', sig.apiKey)
  formData.append('timestamp', sig.timestamp)
  formData.append('signature', sig.signature)
  formData.append('folder', folder)
  formData.append('type', 'authenticated')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return { publicId: data.public_id, resourceType: data.resource_type }
}

// Owner-only: mints a short-lived signed URL to actually view a private
// document. Called on demand (e.g. when the owner clicks "View"), not stored,
// so the link expires rather than staying valid forever.
export async function getPrivateViewUrl(publicId, resourceType) {
  const getUrl = httpsCallable(functions, 'getCloudinarySignedUrl')
  const { data } = await getUrl({ publicId, resourceType })
  return data.url
}
