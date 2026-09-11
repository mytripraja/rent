# Rental Manager — UX / Reliability Update

## What changed
- Owner navigation is now grouped into Daily, Money, Operations, Community, Insights and Admin instead of a long horizontal tab strip.
- Mobile owner navigation uses a compact five-destination bottom bar and a slide-in menu for the rest.
- Owner overview now prioritizes actionable approvals, attention items, quick actions and a house-status pulse.
- Owner rent collection is calculated from actual approved payment records for the current month rather than the house's configured rent amount.
- Tenant navigation is split into Home, Rent & bills, Services, Community and Documents, reducing the long single-page scroll.
- EB and water bill shares are allocated in whole paise/cents using largest-remainder rounding so the displayed shares reconcile exactly to the bill total.
- Tenant bill reads are scoped to bill cycles containing the tenant's house.
- Tenant-created rent, EB and water payments must match the authenticated tenant, their house, and `waiting_approval` status.
- Tenant directory updates are constrained to their own phone visibility/contact representation.
- Visitor updates cannot move a record to another house.

## Deployment note
Older EB/water bill documents need `houseIds` populated before the stricter tenant read rules are deployed. Each field should contain the house IDs represented in that bill's `shares` array.

A one-time Firebase Admin SDK migration can populate it safely:

```js
for (const collectionName of ['ebBills', 'waterBills']) {
  const snap = await db.collection(collectionName).get()
  const batch = db.batch()
  snap.docs.forEach(d => {
    const data = d.data()
    if (!Array.isArray(data.houseIds)) {
      const houseIds = Array.isArray(data.shares) ? data.shares.map(s => s.houseId).filter(Boolean) : []
      batch.update(d.ref, { houseIds })
    }
  })
  await batch.commit()
}
```

Run this with a trusted Admin SDK environment, not from the browser.
