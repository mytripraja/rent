# Rental Manager V6.2 — Security Audit & Hardening

## Findings fixed

### 1. Dad Lite privilege escalation — HIGH
Previously `role: owner` made Dad Lite an owner in Firestore rules even though the UI only showed a rent collection screen. A Dad Lite account could potentially read/write owner-only collections by calling Firestore directly.

**Fixed:** Dad Lite is now a separate security condition. Owner rules exclude `appMode: dad-lite`; Dad Lite uses two narrowly scoped server endpoints for its roster and rent submission.

### 2. Customer ID enumeration — HIGH
`customerLookup/{customerId}` was publicly readable. Because IDs are sequential (`RM1001`, `RM1002`, ...), anyone could enumerate customer IDs and associated login emails.

**Fixed:** direct Firestore reads are denied. Customer-ID login now uses `/api/resolve-customer-id`.

### 3. Rent/EB/water payment creation integrity — HIGH
Tenant create rules previously checked mainly `houseId`, which meant a malicious tenant could attempt to create a payment with `status: approved` or another user's identity.

**Fixed:** tenant-created payment documents must identify the signed-in user, start in `waiting_approval`, have no approval/rejection metadata, and contain a positive amount. Approval/rejection updates are limited to owner-side status fields.

### 4. Agreement signed-URL confused-deputy issue — HIGH
`/api/get-agreement-url` trusted `publicId` and `resourceType` supplied by the browser after checking only the agreement's house. A tenant could potentially pair an authorized agreement ID with another Cloudinary public ID.

**Fixed:** the API now ignores browser-supplied asset identifiers and signs only the identifiers stored on the authorized agreement document.

### 5. Arbitrary private Cloudinary folder signing — HIGH
`/api/sign-upload` would sign any folder supplied by an authenticated client.

**Fixed:** only `private-documents/{houseId}` (with house authorization) and `agreements` (full owner only) are accepted.

### 6. Notification recipient spoofing / spam — MEDIUM
A tenant could create a notification with `recipientType: owner` and choose an arbitrary recipient UID.

**Fixed:** tenant-created notifications must target a real owner/admin account.

### 7. Missing Firestore rules for internal logs — MEDIUM
`activityLog`, `communicationLogs`, and `remindersSent` had no explicit rules, so their intended client operations were denied by default and could cause post-action errors.

**Fixed:** explicit owner-only rules added.

### 8. Parking privacy — MEDIUM
All signed-in users could read parking records, including vehicle numbers and house assignments.

**Fixed:** parking is owner-only.

## Additional audit observations

### Area bookings
The current `areaBookings` design exposes booking records to tenants with the `commonArea` permission. This may reveal other residents' names/purposes. It was not automatically redesigned in this hardening pass because shared availability depends on seeing booking conflicts. A future safe design should separate public availability slots from private booking details.

### Cloudinary unsigned uploads
Rent/EB/water proofs, maintenance images, expense receipts, house photos and profile photos still use Cloudinary unsigned upload flows in the existing application. Unsigned presets can be abused for storage if their Cloudinary preset is not tightly restricted. In Cloudinary, restrict the unsigned preset by allowed formats, maximum file size and fixed/controlled upload folder. A future hardening pass can migrate sensitive proof/receipt uploads to authenticated signed delivery.

### App configuration
`appConfig/general` is readable by signed-in users. It contains operational configuration such as payment modes, UPI details, waste schedule and late-fee settings. It does not contain server secrets, but a cleaner design would split tenant-safe settings from owner-only settings.

### Build verification
The environment did not have a complete installed dependency tree, and `npm ci` timed out. JavaScript API/service syntax checks passed, and the Firestore rules have balanced braces/parentheses, but a full Vite production build still needs to be run locally/CI.

## Recommended production checks

1. Deploy `firestore.rules` together with the application.
2. Test a Dad Lite account by attempting direct Firestore reads/writes from the browser console; owner-only collections should be denied.
3. Test a tenant attempting to create an `approved` rent/EB/water payment; it should be denied.
4. Test agreement URL access using another agreement's public ID; it should return only the authorized agreement asset.
5. Test Customer-ID login and confirm `customerLookup` cannot be read from the browser.
6. Configure Cloudinary upload preset restrictions.
7. Run `npm ci && npm run build` in CI or on the deployment machine before release.
