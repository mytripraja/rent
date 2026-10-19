# Rental Manager V5 — Product & Mobile Upgrade

This release consolidates the next product-level improvements:

- Modern owner overview with rent, resident, property and follow-up information.
- Rent collection on the overview uses the actual approved payment amount for the current month rather than assuming configured rent.
- House cards no longer advertise "vacant" as a primary workflow; the rare vacancy action remains inside the house profile.
- House profile remains the central detail surface with residents, rent history, occupancy history and household accounts.
- Mobile house profile opens as a bottom sheet and keeps the detail tabs usable on narrow screens.
- Tenant mobile filter is a single compact selector with no duplicate status control or horizontal filter strip.
- Tenant page explains that tapping a tenant opens the complete household profile.
- Existing 5-account household/family-account model remains supported with per-account permissions.
- Tenant dashboard receives a compact mobile quick-navigation bar.
- Firestore persistence migrated from the deprecated enableMultiTabIndexedDbPersistence helper to initializeFirestore + persistentLocalCache + persistentMultipleTabManager.
- Added PWA manifest, icons and a versioned service worker for installability and resilient app-shell caching.
- Existing reports, analytics, expenses, maintenance, notices, reminders, payment calendar, exports and More tools remain available.

Deployment:
- Build and deploy the whole V5 source.
- Do not add a history collection-group rule or index unless a future implementation intentionally restores a collectionGroup('history') query.
- After deployment, hard refresh once so the new service worker can install.
