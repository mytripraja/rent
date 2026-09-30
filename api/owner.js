import createOwner from '../lib/ownerAccountCreate.js'
import deleteOwner from '../lib/ownerAccountDelete.js'

export default async function handler(req, res) {
  const action = String(req.query?.action || req.body?.action || '').trim()
  if (action === 'create') return createOwner(req, res)
  if (action === 'delete') return deleteOwner(req, res)
  return res.status(404).json({ error: 'Owner route not found' })
}
