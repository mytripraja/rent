import { auth, db, requireOwner } from '../lib/firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'

// This is exactly what used to be the createTenantAccountAdmin Cloud Function.
// Running it as a Vercel serverless function instead means creating a tenant's
// login no longer touches the owner's own signed-in session (the Admin SDK
// creates the user server-side, so the browser's active session is untouched)
// — and it doesn't need Firebase Blaze at all.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await requireOwner(req)

    const { email, password, name, phone, houseId, aadhaarNumber } = req.body || {}
    if (!email || !password || !name || !houseId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const userRecord = await auth.createUser({ email, password, displayName: name })

    // Reuse an existing Customer ID if this Aadhaar number already has one.
    let customerId
    if (aadhaarNumber) {
      const existing = await db
        .collection('customers')
        .where('aadhaarNumber', '==', aadhaarNumber)
        .limit(1)
        .get()
      if (!existing.empty) {
        customerId = existing.docs[0].id
        await existing.docs[0].ref.update({
          linkedUids: FieldValue.arrayUnion(userRecord.uid),
          linkedHouseIds: FieldValue.arrayUnion(houseId),
        })
      }
    }

    if (!customerId) {
      customerId = await db.runTransaction(async (tx) => {
        const counterRef = db.collection('counters').doc('customerId')
        const counterSnap = await tx.get(counterRef)
        const current = counterSnap.exists ? counterSnap.data().value : 1000
        const next = current + 1
        tx.set(counterRef, { value: next }, { merge: true })
        const id = `RM${next}`
        tx.set(db.collection('customers').doc(id), {
          customerId: id,
          name,
          phone,
          email,
          aadhaarNumber: aadhaarNumber || null,
          linkedUids: [userRecord.uid],
          linkedHouseIds: [houseId],
          createdAt: Date.now(),
        })
        tx.set(db.collection('customerLookup').doc(id), { email })
        return id
      })
    }

    await db.collection('users').doc(userRecord.uid).set({
      role: 'tenant',
      name,
      email,
      phone,
      houseId,
      customerId,
      createdAt: Date.now(),
    })

    res.status(200).json({ uid: userRecord.uid, customerId })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
