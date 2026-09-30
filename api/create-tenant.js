import { auth, db, requireOwnerLevel, ownerCanAccessProperty } from '../lib/firebaseAdmin.js'
import { FieldValue } from 'firebase-admin/firestore'

// This is exactly what used to be the createTenantAccountAdmin Cloud Function.
// Running it as a Vercel serverless function instead means creating a tenant's
// login no longer touches the owner's own signed-in session (the Admin SDK
// creates the user server-side, so the browser's active session is untouched)
// — and it doesn't need Firebase Blaze at all.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const decoded = await requireOwnerLevel(req)
    const callerDoc = await db.collection('users').doc(decoded.uid).get()
    const caller = callerDoc.data() || {}
    const recordedBy = { uid: decoded.uid, name: caller.name || 'Owner' }

    const { email, name, phone, houseId, aadhaarNumber } = req.body || {}
    if (!name || !houseId) {
      return res.status(400).json({ error: 'Name and house are required.' })
    }
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (normalizedEmail && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid email address.' })
    const houseSnap = await db.collection('houses').doc(String(houseId)).get()
    if (!houseSnap.exists) return res.status(404).json({ error: 'House not found.' })
    const propertyId = String(houseSnap.data()?.propertyId || 'default')
    if (!ownerCanAccessProperty(caller, propertyId)) return res.status(403).json({ error: 'You do not have access to this property.' })

    const userRecord = await auth.createUser({
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      displayName: name
    })

    try {
      // Resolve a reusable customer before the transaction, then commit every
      // Firestore link/write atomically. If any Firestore step fails, the new
      // Auth identity is deleted below so an orphan tenant login is not left behind.
      let existingCustomerRef = null
      if (aadhaarNumber) {
        const existing = await db
          .collection('customers')
          .where('aadhaarNumber', '==', aadhaarNumber)
          .limit(1)
          .get()
        if (!existing.empty) existingCustomerRef = existing.docs[0].ref
      }

      const customerId = await db.runTransaction(async (tx) => {
        let resolvedCustomerId

        if (existingCustomerRef) {
          const existingCustomer = await tx.get(existingCustomerRef)
          if (!existingCustomer.exists) throw new Error('Existing customer record was removed. Please try again.')
          resolvedCustomerId = existingCustomer.id
          tx.update(existingCustomerRef, {
            linkedUids: FieldValue.arrayUnion(userRecord.uid),
            linkedHouseIds: FieldValue.arrayUnion(houseId),
          })
        } else {
          const counterRef = db.collection('counters').doc('customerId')
          const counterSnap = await tx.get(counterRef)
          const current = counterSnap.exists ? counterSnap.data().value : 1000
          const next = current + 1
          tx.set(counterRef, { value: next }, { merge: true })
          resolvedCustomerId = `RM${next}`
          tx.set(db.collection('customers').doc(resolvedCustomerId), {
            customerId: resolvedCustomerId,
            name,
            phone,
            email: normalizedEmail || null,
            aadhaarNumber: aadhaarNumber || null,
            linkedUids: [userRecord.uid],
            linkedHouseIds: [houseId],
            createdAt: Date.now(),
          })
          tx.set(db.collection('customerLookup').doc(resolvedCustomerId), { email: normalizedEmail || null })
        }

        tx.set(db.collection('users').doc(userRecord.uid), {
          role: 'tenant',
          accountType: 'primary',
          name,
          email: normalizedEmail || null,
          phone,
          houseId,
          propertyId,
          customerId: resolvedCustomerId,
          tenantPermissions: { rent: true, rentStatus: true, rentDetails: true, rentSubmit: true, bills: true, notices: true, complaints: true, maintenance: true, visitors: true, commonArea: true, documents: true, directory: true, community: true },
          createdAt: Date.now(),
          createdBy: recordedBy,
        })

        return resolvedCustomerId
      })

      res.status(200).json({ uid: userRecord.uid, customerId })
      return
    } catch (firestoreErr) {
      try {
        await auth.deleteUser(userRecord.uid)
      } catch (cleanupErr) {
        console.error('Tenant creation rollback failed:', cleanupErr)
      }
      throw firestoreErr
    }

  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}
