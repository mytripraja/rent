# Rental Manager V4.1 — Tenant Screen Firestore Fix

- Fixed the owner Tenants screen failing with `FirebaseError: Missing or insufficient permissions`.
- Replaced the collection-group `history` query used by `listPastTenants()` with direct reads of each known house history subcollection.
- This avoids collection-group rule/index edge cases and does not require a composite Firestore index.
- The existing owner rules for `/houses/{houseId}/history/{entryId}` remain owner-only.
- The Firebase IndexedDB deprecation warning shown in Chrome is informational and is not the cause of the tenant loading failure.
