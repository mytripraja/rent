import { db } from '../lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const id = String(req.query?.id || '').trim()
    const token = String(req.query?.token || '').trim()
    if (!id || !token || id.length > 160 || token.length > 200) return res.status(400).json({ error: 'Invalid announcement link' })
    const snap = await db.collection('notices').doc(id).get()
    if (!snap.exists) return res.status(404).json({ error: 'Announcement not found' })
    const data = snap.data() || {}
    if (!data.publicShareEnabled || data.publicToken !== token) return res.status(404).json({ error: 'Announcement link is invalid or disabled' })

    let affectedHomes = []
    if (Array.isArray(data.targetHouseIds)) {
      const refs = data.targetHouseIds.slice(0, 50).map(id => db.collection('houses').doc(String(id)))
      const houseSnaps = await db.getAll(...refs)
      affectedHomes = houseSnaps.filter(s => s.exists).map(s => String(s.data()?.internalDoorNumber || s.id)).filter(Boolean)
    }
    const previousUpdates = []
    let cursor = data.parentNoticeId ? String(data.parentNoticeId) : ''
    const seen = new Set([id])
    for (let i = 0; i < 8 && cursor; i += 1) {
      if (seen.has(cursor)) break
      seen.add(cursor)
      const parentSnap = await db.collection('notices').doc(cursor).get()
      if (!parentSnap.exists) break
      const parent = parentSnap.data() || {}
      if (parent.publicShareEnabled === false || !parent.publicToken) break
      previousUpdates.push({ id: cursor, title: parent.title || parent.message || 'Announcement', titleTamil: parent.titleTamil || '', message: parent.message || '', messageTamil: parent.messageTamil || '', updateNumber: Number(parent.updateNumber || 1), continuationLabel: parent.continuationLabel || null, shareUrl: `/notice/${cursor}?token=${encodeURIComponent(parent.publicToken)}` })
      cursor = parent.parentNoticeId ? String(parent.parentNoticeId) : ''
    }
    const linkedAnnouncements = []
  const linkedIds = Array.isArray(data.linkedNoticeIds) ? data.linkedNoticeIds.slice(0, 20) : []
  if (linkedIds.length) {
    const linkedRefs = linkedIds.map(linkId => db.collection('notices').doc(String(linkId)))
    const linkedSnaps = await db.getAll(...linkedRefs)
    linkedSnaps.forEach((linkedSnap, index) => {
      if (!linkedSnap.exists) return
      const linked = linkedSnap.data() || {}
      if (String(linked.propertyId || 'default') !== String(data.propertyId || 'default')) return
      if (linked.publicShareEnabled === false || !linked.publicToken) return
      linkedAnnouncements.push({ id: linkedSnap.id, title: linked.title || linked.message || 'Announcement', titleTamil: linked.titleTamil || '', message: linked.message || '', messageTamil: linked.messageTamil || '', category: linked.category || linked.type || 'Notice', shareUrl: `/notice/${linkedSnap.id}?token=${encodeURIComponent(linked.publicToken)}` })
    })
  }
  const notice = {
      createdAt: data.createdAt || null,
      title: data.title || data.message || 'Announcement',
      titleTamil: data.titleTamil || '',
      category: data.category || data.type || 'Notice',
      categoryTamil: data.categoryTamil || '',
      message: data.message || '',
      messageTamil: data.messageTamil || '',
      additionalDetails: data.additionalDetails || '',
      additionalDetailsTamil: data.additionalDetailsTamil || '',
      reason: data.reason || '',
      reasonTamil: data.reasonTamil || '',
      happenedAt: data.happenedAt || null,
      expectedResolutionAt: data.expectedResolutionAt || null,
      resolvedAt: data.resolvedAt || null,
      status: data.status || 'active',
      targetHouseIds: data.targetHouseIds || 'all',
      affectedHomes: data.targetHouseIds === 'all' ? [] : affectedHomes,
      imageUrl: data.imageUrl || null,
      updateNumber: Number(data.updateNumber || 0) || null,
      continuationLabel: data.continuationLabel || null,
      previousUpdates,
      showTimeDetails: data.showTimeDetails !== false,
      linkedAnnouncements,
    }
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({ notice })
  } catch (err) {
    return res.status(500).json({ error: 'Could not load announcement' })
  }
}
