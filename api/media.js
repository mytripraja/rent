import getAgreementUrl from '../lib/getAgreementUrlHandler.js'
import getSignedUrl from '../lib/getSignedUrlHandler.js'

export default async function handler(req, res) {
  const action = String(req.query?.action || req.body?.action || '').trim()
  if (action === 'agreement') return getAgreementUrl(req, res)
  if (action === 'signed') return getSignedUrl(req, res)
  return res.status(404).json({ error: 'Media route not found' })
}
