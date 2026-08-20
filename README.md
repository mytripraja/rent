# Rental Manager — MVP

Core built: **Owner/Tenant auth (email/password, Google, Customer ID) · Bank-style unique Customer ID system · House profiles (create/book/vacate, one-time Setup + everyday Houses tab split) · Rent submission + approval flow (UPI/bank/cash/neighbor) · Owner-assisted manual entry · Rent revision announcements · EB bill split calculator + full UI · Pinned color-coded notices · Complaints (tenant→owner private, owner→house targeted) · Directory (neighbors + vacant houses, phone-hide toggle) · Service contacts (click-to-call, Google Maps links) · Document verification (Aadhaar/ration card + consent signature, stored on Cloudinary) · Community message board · Security rules · Vacate access-revoke Cloud Function · Mobile-responsive layout**

**Every module from the original spec is now built.** Only the onboarding tour/animations remain — see bottom of this file.

## Setup

1. Create a Firebase project → enable **Email/Password Auth**, **Google Auth** (Authentication → Sign-in method → Google → Enable, set a support email), **Firestore**, and **Functions** (needs the Blaze pay-as-you-go plan — the free tier covers this app's usage easily). Firebase Storage is **not** used — see the Cloudinary section below.
2. Copy `.env.example` to `.env` and fill in your Firebase web app config (Project settings → General → Your apps) plus your Cloudinary values (see below).
3. In Vercel, add the same variables (with `VITE_` prefix, matching your existing MyTripRaja setup).
4. `npm install`
5. `npm run dev` to test locally, or push to GitHub → Vercel auto-deploys.
6. `cd functions && npm install`, copy `functions/.env.example` to `functions/.env` and fill in your Cloudinary API secret, then from the project root: `firebase deploy --only firestore:rules,functions`

## File storage — Cloudinary, not Firebase

All uploads (rent proofs, EB proofs, Aadhaar/ration card) go through Cloudinary now, not Firebase Storage.

1. Create a free Cloudinary account → note your **Cloud Name** from the dashboard.
2. Settings → Upload → Add upload preset → **Signing mode: Unsigned** → name it something like `rental-manager-proofs`. This preset is used for rent/EB payment screenshots — they don't need to be locked down any tighter than they already were (any signed-in user could see them before too).
3. Set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` (the preset name from step 2) in your `.env`.
4. Settings → Security → API Keys → copy your **API Key** and **API Secret**. Put all three (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) in `functions/.env` — **never** put the API secret in the frontend `.env`, only the functions one.

**Why Aadhaar/ration card uploads still touch a Cloud Function:** Cloudinary can only make an upload truly private (`type: 'authenticated'`, unreachable by any plain URL) if the upload request is *signed*, and signing requires your API secret — which can never sit in browser code. So `getCloudinarySignature` (a Cloud Function) signs the upload server-side without ever sending the secret to the client, and `getCloudinarySignedUrl` (owner-only) mints a fresh 5-minute link each time you click "View" on a document, rather than storing one permanent link. Rent/EB proofs skip this entirely and upload directly from the browser with the unsigned preset — simpler, and no less private than before.

## Login — 3 ways

- **Email + password** — normal Firebase Auth
- **Customer ID + password** — the ID looks like `RM1001`. Login resolves the ID to the linked email (via a public `customerLookup` doc containing only that email), then signs in normally.
- **Google** — works if the tenant's Google account email matches the email on file. If they already have a password login under that email, Firebase will ask them to sign in with the password once and link Google from there (handled — see `linkGoogleToCurrentAccount()` in `authService.js`).

## Customer ID system

Every tenant gets a unique ID (`RM1001`, `RM1002`, …) the moment their account is created — same idea as a bank customer ID. If the same person (matched by Aadhaar number) rents a second house later, they keep their existing ID instead of getting a new one; both houses link under it via `linkedHouseIds` on their `customers/{id}` doc.

**Important implementation detail:** creating a tenant's login now goes through a Cloud Function (`createTenantAccountAdmin`) instead of the client SDK. If it were done client-side, Firebase Auth would silently switch your owner session over to the newly created tenant the moment their account is made — you'd get logged out mid-booking. The function uses the Admin SDK so your session is untouched.

## Adding your houses (one-time)

House creation lives under the **Setup** tab, separate from the everyday **Houses** tab — since you said you'll only add the 13 houses once, not routinely. **Houses** stays focused on booking/vacating/occupancy; **Setup** is where you add a house record if you ever add a new physical unit to the property later.

## Create your owner account

There's no signup UI yet on purpose (you don't want random signups). Create the first owner account by running this once in the browser console on the login page, or I can add a one-time setup script — tell me which you'd prefer.

```js
import { createOwnerAccount } from './services/authService'
await createOwnerAccount({ email: 'you@example.com', password: '...', name: 'Deepu' })
```

## Security rules + Cloud Functions (now included)

- `firestore.rules` — owner has full access; tenants can only read/write their own house's rent and EB payments, read (not write) their own house doc, and read/create their own complaints. Notices and the community board are readable by anyone signed in.
- `functions/index.js`:
  - `setRoleClaim` / `syncRoleClaimOnUpdate`: stamps the `role` custom claim on each user's auth token when their `users/{uid}` doc is created or changed.
  - `revokeAccessAfterVacate`: runs every 15 minutes, finds houses where the 1-hour vacate window has passed, and disables the departed tenant's login.
  - `createTenantAccountAdmin`: creates a tenant's Firebase Auth account + Customer ID via Admin SDK, without disturbing the owner's session.
  - `getCloudinarySignature` / `getCloudinarySignedUrl`: sign private Cloudinary uploads and mint short-lived view links for Aadhaar/ration card documents (see the Cloudinary section above).

**Deploy these** (from the project root, with the Firebase CLI installed and logged in):
```
firebase deploy --only firestore:rules,functions
```

## What's built vs. what's next

**Built (this MVP):**
- Owner: house grid (occupied/vacant), create house, book house (creates tenant login), vacate house (advance return fields), rent approval queue (cash/neighbor-aware)
- Tenant: rent submission (UPI/bank/cash/neighbor + screenshot upload), rent history with status badges
- **EB Bill (full):**
  - Owner: per-house override panel (own-meter opt-out, partial-months-occupied), live split preview before creating a cycle, past cycles list, approval queue for EB payments
  - Tenant: sees their share per cycle with due date and status badge, pays via the same UPI/bank/cash/neighbor flow as rent
- **Notices:**
  - Owner (`NoticeManager.jsx`): pick type (water/EB/both/urgent/general/other — matches your color scheme), message, optional time window text, optional auto-expire duration, target all houses or hand-pick specific ones. List of all notices with active/expired state and delete.
  - Tenant (`NoticeFeed.jsx`): pinned banners at the top of their dashboard, filtered to notices meant for their house
- **Complaints:**
  - Owner (`ComplaintInbox.jsx`): all tenant complaints in one inbox (private — tenants never see each other's), filter by open/resolved/all, mark resolved. Also send a complaint outward to one house, several, or all.
  - Tenant (`RaiseComplaint.jsx`): submit a private complaint to the owner, and see any complaints the owner has sent to their house, with status
- **Directory:**
  - New `directory` collection mirrors only safe fields (door number, name, phone-if-visible, status) off the `houses` collection, so tenants never read each other's full house doc (which holds rent/advance amounts). Kept in sync automatically whenever a house is booked, vacated, or a tenant flips their own visibility toggle.
  - Tenant (`Directory.jsx`): list of neighbors with phone (if they've allowed it), a self-service "show my phone to neighbors" toggle, and the list of currently vacant houses
- **Service Contacts:**
  - Owner (`ServiceContactsManager.jsx`): add/delete contacts by category (EB staff, EB office, AC technician, mechanic, puncture shop, electrician, other), each with a phone number and/or Google Maps link
  - Tenant (`ServiceContacts.jsx`): read-only grouped list with tap-to-call and tap-to-open-in-Maps
  - Shared `ServiceContactsList.jsx` renders both views so the grouping/format only lives in one place
- **Rent Revision:**
  - Owner (`RentRevision.jsx`): announce a future increase for a house (new amount + effective month) without touching the current rent yet. Pending revisions list shows "Apply now" (manually switches the standing rent once the month arrives — kept as a deliberate action rather than a silent cron flip) or "Cancel".
  - Tenant (`RentRevisionBanner.jsx`): banner at the top of their dashboard — "From [month], your rent will be ₹X" — until the owner applies it.
- **Owner-Assisted Manual Entry:**
  - Owner (`ManualEntryForTenant.jsx`): for tenants who can't use the app (e.g. elderly). Pick their house, enter month/amount/date/mode exactly like the tenant would, optionally attach a proof screenshot. Saved with an "Uploaded by Owner" tag so it's visibly distinct everywhere it shows up (approval queue, rent history), and there's a one-tap "Approve immediately" since you're both the submitter and approver in this case.
- **Document Verification:**
  - Tenant (`DocumentUpload.jsx`): upload Aadhaar or ration card, resident's full name, a consent paragraph they must check, and a typed signature that has to match the resident name exactly before the submit button unlocks.
  - Owner (`DocumentVerification.jsx`): documents grouped by house, thumbnail + who signed + when. Files sit under Storage's `private-documents/` path, which only the `owner` custom claim can read — a tenant's browser literally cannot fetch another resident's document even if they had the URL.
- **Community Board:**
  - Shared `CommunityBoard.jsx` component used on both dashboards — WhatsApp-group-style feed, your own messages align right, everyone else's left, owner messages tinted so they stand out. Owner gets a delete option on every message for moderation; tenants don't.

**Not yet built** (from the full spec doc):
- Onboarding tour + animations — happy to do this last, once you've seen the real screens and have a feel for what actually needs explaining to a first-time user

**Note on existing houses:** the `directory` mirror only gets created/updated going forward (on create/book/vacate/visibility-toggle). If you add houses before this update reaches production, run a one-time backfill — happy to write a small script for that when you're ready to deploy.

## File structure

Each feature lives in its own file under `/src/modules/owner`, `/src/modules/tenant`, or `/src/modules/shared`, backed by one service file per domain in `/src/services`. Updating "just rent" or "just houses" means touching one file.
