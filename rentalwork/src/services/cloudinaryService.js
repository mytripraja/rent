import { authedFetch } from './firebase'

// Server-signed uploads. The server allow-lists folders and verifies the caller
// against the house/property before issuing the signature. Sensitive proofs use
// Cloudinary authenticated delivery, so their URLs are not public.
export async function uploadSigned(file, folder, { visibility = 'upload' } = {}) {
  const sig = await authedFetch('/api/sign-upload', { folder, visibility })
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', sig.apiKey)
  formData.append('timestamp', sig.timestamp)
  formData.append('signature', sig.signature)
  formData.append('folder', folder)
  formData.append('type', sig.type || visibility)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return { url: data.secure_url || null, publicId: data.public_id, resourceType: data.resource_type }
}

export async function uploadPrivate(file, folder) {
  return uploadSigned(file, folder, { visibility: 'authenticated' })
}

export async function getPrivateViewUrl(documentId) {
  const data = await authedFetch('/api/get-signed-url', { documentId })
  return data.url
}


export async function getPaymentProofUrl(proofCollection, proofId) {
  const data = await authedFetch('/api/get-signed-url', { proofCollection, proofId })
  return data.url
}

export async function getPrivateCctvViewUrl(requestId) {
  const data = await authedFetch('/api/get-cctv-signed-url', { requestId })
  return data.url
}
