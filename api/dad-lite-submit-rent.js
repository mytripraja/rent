import { db, requireDadLite } from '../lib/firebaseAdmin.js'

const RECEIVERS = new Set(['Deepu', 'Rajavel', 'Dada', 'Siva', 'Brother'])

function monthOk(month) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) }
function dateOk(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) }
function applicationNumber() {
  const now = Date.now().toString().slice(-8)
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `RENT-${now}-${rand}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    const { decoded, profile } = await requireDadLite(req)
    const houseId = String(req.body?.houseId || '').trim()
    const month = String(req.body?.month || '').trim()
    const dateSent = String(req.body?.dateSent || '').trim()
    const receiver = String(req.body?.cashReceivedBy || '').trim()

    if (!houseId || !monthOk(month) || !dateOk(dateSent) || !receiver) {
      return res.status(400).json({ error: 'House, month, payment date and receiver are required.' })
    }
    if (receiver === 'Others') {
      const other = String(req.body?.otherReceiver || '').trim()
      if (!other || other.length > 80) return res.status(400).json({ error: 'Enter the receiver name.' })
    } else if (!RECEIVERS.has(receiver)) {
      return res.status(400).json({ error: 'Invalid receiver.' })
    }

    const houseSnap = await db.collection('houses').doc(houseId).get()
    if (!houseSnap.exists) return res.status(404).json({ error: 'House not found.' })
    const house = houseSnap.data()
    if (house.status !== 'occupied' || !house.currentTenantId) {
      return res.status(400).json({ error: 'This house is not currently occupied.' })
    }

    const amount = Number(house.rentAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'This house does not have a valid rent amount.' })

    // Do not allow Dad Lite to create a second waiting/approved entry for the
    // same house and month. Existing rejected entries can be resubmitted.
    const existing = await db.collection('rentPayments')
      .where('houseId', '==', houseId)
      .where('month', '==', month)
      .get()
    if (existing.docs.some(d => ['waiting_approval', 'approved'].includes(d.data().status))) {
      return res.status(409).json({ error: 'Rent is already marked as paid or waiting for approval.' })
    }

    const finalReceiver = receiver === 'Others'
      ? String(req.body?.otherReceiver || '').trim().slice(0, 80)
      : receiver
    const appNo = applicationNumber()
    const data = {
      houseId,
      tenantId: house.currentTenantId,
      month,
      amount,
      dateSent,
      mode: 'cash',
      cashReceivedBy: finalReceiver,
      neighborHouseId: null,
      neighborCollectedBy: null,
      proofUrl: null,
      applicationNumber: appNo,
      status: 'waiting_approval',
      uploadedByOwner: true,
      recordedBy: { uid: decoded.uid, name: profile.name || 'Owner' },
      entrySource: 'dad_lite',
      rejectionReason: null,
      submittedAt: Date.now(),
      approvedAt: null,
      actionedBy: null,
    }
    const ref = await db.collection('rentPayments').add(data)
    await db.collection('activityLog').add({
      action: 'submitted',
      entityType: 'rent',
      entityId: ref.id,
      performedBy: decoded.uid,
      performedByName: profile.name || 'Dad Lite',
      details: `Dad Lite submitted rent for ${house.internalDoorNumber || houseId} for ${month}`,
      timestamp: Date.now(),
    })
    return res.status(200).json({ applicationNumber: appNo })
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Unable to submit rent' })
  }
}
