# Rental Manager update — rent workflow and mobile reliability

## Changes in this package
- Rent approvals now include an Approval history view with month-by-month filtering and status/rejection details.
- Manual rent entry has a refreshed responsive layout, prefilled house support from the Houses screen, and an existing-entry preview for the selected house/month before submission.
- Each occupied house card includes a direct “Enter rent” action.
- EB and water pending-approval queries now fetch each known house independently instead of using a multi-house `in` query that can be rejected by property-scoped Firestore rules.
- Rent tracking start month is now returned by the tenant-safe house/status API. Months before the configured start month are marked “Not tracked” instead of showing as system-generated arrears; historic payment records remain in the history and are not deleted.
- House → Rent history labels the secure approved-payment action “Correct / reverse”; corrections remain behind the existing critical-change password/device verification and audit workflow.

## Before deploying
- Run `npm ci`, `npm run build`, and `npm test` in a network-enabled development environment.
- Deploy the updated Vercel API and frontend together. The UI cannot repair a deployed Firestore rules mismatch by itself; if EB/water still returns `Missing or insufficient permissions`, inspect the rules for `ebBillPayments` and `waterBillPayments` for each owner-accessible house.
- Test on a mobile browser and installed Android wrapper, especially native back navigation, tenant selection, and rent start-month boundaries.
- No live Firebase or production deployment was performed as part of this source update.
