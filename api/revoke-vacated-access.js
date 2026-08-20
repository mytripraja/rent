import { auth, db } from '../lib/firebaseAdmin.js'

// Sweeps for houses past their vacate-access-revoke window and disables that
// tenant's login. Called by GitHub Actions on a schedule (see
// .github/workflows/revoke-access.yml) since Vercel's free-tier cron only
// runs once a day, which isn't precise enough for a 1-hour window.
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Shared-secret auth, not a user token — this is called by a scheduler, not a person.
  const providedSecret = req.headers['x-cron-secret']
  if (!process.env.REVOKE_CRON_SECRET || providedSecret !== process.env.REVOKE_CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = Date.now()
    const snap = await db
      .collection('houses')
      .where('accessRevokeScheduledAt', '<=', now)
      .where('accessRevokeScheduledAt', '>', 0)
      .get()

    let revoked = 0

    for (const houseDoc of snap.docs) {
      const historySnap = await db
        .collection('houses')
        .doc(houseDoc.id)
        .collection('history')
        .orderBy('movedInAt', 'desc')
        .limit(1)
        .get()

      if (!historySnap.empty) {
        const tenantId = historySnap.docs[0].data().tenantId
        if (tenantId) {
          await auth.updateUser(tenantId, { disabled: true }).catch(() => {})
          revoked++
        }
      }

      await houseDoc.ref.update({ accessRevokeScheduledAt: 0 })
    }

    res.status(200).json({ checked: snap.size, revoked })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
