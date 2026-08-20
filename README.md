# Rental Manager — MVP

Core built: **Owner/Tenant auth (email/password, Google, Customer ID) · Bank-style unique Customer ID system · House profiles (create/book/vacate, one-time Setup + everyday Houses tab split) · Rent submission + approval flow (UPI/bank/cash/neighbor) · Owner-assisted manual entry · Rent revision announcements · EB bill split calculator + full UI · Pinned color-coded notices · Complaints (tenant→owner private, owner→house targeted) · Directory (neighbors + vacant houses, phone-hide toggle) · Service contacts (click-to-call, Google Maps links) · Document verification (Aadhaar/ration card + consent signature, private Cloudinary storage) · Community message board · Animated onboarding tour · Security rules · Vacate access-revoke sweep · Mobile-responsive layout**

**Every module from the original spec is now built** — including the onboarding tour.

## No Firebase billing required — Vercel serverless functions instead of Cloud Functions

Firebase Cloud Functions require the Blaze (pay-as-you-go) plan to deploy at all, even if your usage stays inside the free quota — that credit-card requirement is a real blocker for an MVP. So all four things that used to be Cloud Functions now run as **Vercel serverless functions** in `/api` instead, using the Firebase **Admin SDK** directly:

- `api/create-tenant.js` — creates a tenant's login + Customer ID (Admin SDK, so it never touches the owner's own session)
- `api/sign-upload.js` / `api/get-signed-url.js` — sign private Cloudinary uploads/views for Aadhaar/ration card documents
- `api/revoke-vacated-access.js` — disables a vacated tenant's login once their 1-hour access window passes

**Why this works without Blaze:** the Admin SDK itself doesn't require any Firebase billing plan — Blaze is only needed to *deploy code onto Firebase's own Cloud Functions infrastructure*. Running that same Admin SDK code on someone else's infrastructure (Vercel, in this case) is free on Firebase's Spark plan. You just need a **service account key** (Firebase Console → Project Settings → Service Accounts → Generate new private key) instead of a deployed function.

**One real trade-off, and how it's covered:** Vercel's free Hobby tier only runs cron jobs **once a day** (and even then, sometime within that hour — not precisely on schedule), so it can't hit the "check every 15 minutes" cadence the 1-hour vacate window needs. Rather than silently let that slip to "revoked sometime within 24 hours," `revoke-vacated-access.js` is instead triggered by a **free GitHub Actions scheduled workflow** (`.github/workflows/revoke-access.yml`) every 15 minutes — GitHub Actions has no such daily cap on its free tier. It calls the endpoint over plain HTTPS with a shared secret, so no GitHub-side Firebase credentials are needed at all.

## Setup

1. Create a Firebase project → enable **Email/Password Auth**, **Google Auth** (Authentication → Sign-in method → Google → Enable, set a support email), and **Firestore**. That's it — **no Functions, no Blaze plan.**
2. Firebase Console → Project Settings → Service Accounts → **Generate new private key**. Save the downloaded JSON somewhere safe (never commit it).
3. Copy `.env.example` to `.env` and fill in your Firebase web app config, Cloudinary values, and (for local testing of `/api` routes with `vercel dev`) the server-only vars — see the comments in `.env.example` for which vars are client-safe (`VITE_` prefix) vs. server-only.
4. In Vercel: Project Settings → Environment Variables → add every variable from `.env.example`. For `FIREBASE_SERVICE_ACCOUNT_KEY`, paste the entire downloaded JSON as one line. **Never** add the `CLOUDINARY_API_SECRET` or `FIREBASE_SERVICE_ACCOUNT_KEY` with a `VITE_` prefix — that would ship them to the browser.
5. `npm install`
6. `npm run dev` to test the frontend locally (the `/api` routes need `vercel dev` instead, or just test them after deploying — see below).
7. Push to GitHub → Vercel auto-deploys, and automatically picks up the `/api` folder as serverless functions. No separate deploy step needed for them.
8. `firebase deploy --only firestore:rules` — this one command still uses the Firebase CLI, but only for Firestore rules, which is free on Spark.

## Setting up the GitHub Actions vacate-revoke schedule

1. In your GitHub repo: Settings → Secrets and variables → Actions → **New repository secret** → name `REVOKE_CRON_SECRET`, value: any random 16+ character string. Use the **same value** for the `REVOKE_CRON_SECRET` env var in Vercel.
2. Settings → Secrets and variables → Actions → **Variables** tab → **New repository variable** → name `VERCEL_APP_DOMAIN`, value: your deployed domain (e.g. `rent-yourname.vercel.app`, no `https://`).
3. That's it — the workflow in `.github/workflows/revoke-access.yml` picks both up automatically once pushed. You can trigger it manually from the Actions tab to test it (`workflow_dispatch`).

## File storage — Cloudinary, not Firebase

All uploads (rent proofs, EB proofs, Aadhaar/ration card) go through Cloudinary, not Firebase Storage.

1. Create a free Cloudinary account → note your **Cloud Name** from the dashboard.
2. Settings → Upload → Add upload preset → **Signing mode: Unsigned** → name it something like `rental-manager-proofs`. This preset is used for rent/EB payment screenshots — they don't need to be locked down any tighter than they already were (any signed-in user could see them before too).
3. Set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` (the preset name from step 2).
4. Settings → Security → API Keys → copy your **API Key** and **API Secret**. Put all three (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) in Vercel's environment variables **without** the `VITE_` prefix — that prefix is what tells Vite to expose a variable to the browser, so the secret must never carry it.

**Why Aadhaar/ration card uploads still touch a serverless function:** Cloudinary can only make an upload truly private (`type: 'authenticated'`, unreachable by any plain URL) if the upload request is *signed*, and signing requires your API secret — which can never sit in browser code. So `api/sign-upload.js` signs the upload server-side without ever sending the secret to the client, and `api/get-signed-url.js` (owner-only) mints a fresh 5-minute link each time you click "View" on a document, rather than storing one permanent link. Rent/EB proofs skip this entirely and upload directly from the browser with the unsigned preset — simpler, and no less private than before.

## Login — 3 ways

- **Email + password** — normal Firebase Auth
- **Customer ID + password** — the ID looks like `RM1001`. Login resolves the ID to the linked email (via a public `customerLookup` doc containing only that email), then signs in normally.
- **Google** — works if the tenant's Google account email matches the email on file. If they already have a password login under that email, Firebase will ask them to sign in with the password once and link Google from there (handled — see `linkGoogleToCurrentAccount()` in `authService.js`).

## Customer ID system

Every tenant gets a unique ID (`RM1001`, `RM1002`, …) the moment their account is created — same idea as a bank customer ID. If the same person (matched by Aadhaar number) rents a second house later, they keep their existing ID instead of getting a new one; both houses link under it via `linkedHouseIds` on their `customers/{id}` doc.

**Important implementation detail:** creating a tenant's login goes through `api/create-tenant.js` (Admin SDK) instead of the client SDK. If it were done client-side, Firebase Auth would silently switch your owner session over to the newly created tenant the moment their account is made — you'd get logged out mid-booking. Running it server-side means your session is never touched.

## Adding your houses (one-time)

House creation lives under the **Setup** tab, separate from the everyday **Houses** tab — since you said you'll only add the 13 houses once, not routinely. **Houses** stays focused on booking/vacating/occupancy; **Setup** is where you add a house record if you ever add a new physical unit to the property later.

## Create your owner account

There's no signup UI yet on purpose (you don't want random signups). Create the first owner account by running this once in the browser console on the login page, or I can add a one-time setup script — tell me which you'd prefer.

```js
import { createOwnerAccount } from './services/authService'
await createOwnerAccount({ email: 'you@example.com', password: '...', name: 'Deepu' })
```

## Security rules + serverless functions (now included)

- `firestore.rules` — owner has full access; tenants can only read/write their own house's rent and EB payments, read (not write) their own house doc, and read/create their own complaints. Notices and the community board are readable by anyone signed in.
- `api/create-tenant.js` — creates a tenant's Firebase Auth account + Customer ID via Admin SDK, without disturbing the owner's session.
- `api/sign-upload.js` / `api/get-signed-url.js` — sign private Cloudinary uploads and mint short-lived view links for Aadhaar/ration card documents (see the Cloudinary section above).
- `api/revoke-vacated-access.js` — disables a vacated tenant's login once their 1-hour access window passes. Triggered by the GitHub Actions schedule, not Vercel cron (see above for why).
- `lib/firebaseAdmin.js` — shared Admin SDK setup + auth-checking helpers (`requireAuth`, `requireOwner`) used by all four functions above.

There's no `setRoleClaim` equivalent anymore — it existed to support the old Firebase Storage rules, which are gone now that everything's on Cloudinary. Nothing in the current `firestore.rules` checks a custom claim; `isOwner()`/`isTenant()` both read the `users/{uid}` Firestore doc directly.

**Deploy Firestore rules** (the only thing that still uses the Firebase CLI):
```
firebase deploy --only firestore:rules
```
Everything in `/api` deploys automatically with the rest of the app whenever you push to GitHub — Vercel detects the folder and provisions serverless functions for each file, no separate step.

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
  - Owner (`DocumentVerification.jsx`): documents grouped by house, thumbnail + who signed + when. Files are private Cloudinary assets — a tenant's browser can't fetch another resident's document even with a direct URL, since viewing requires a freshly signed 5-minute link that only `api/get-signed-url.js` (owner-only) will mint.
- **Community Board:**
  - Shared `CommunityBoard.jsx` component used on both dashboards — WhatsApp-group-style feed, your own messages align right, everyone else's left, owner messages tinted so they stand out. Owner gets a delete option on every message for moderation; tenants don't.
- **Onboarding Tour:**
  - Shared `OnboardingTour.jsx` (uses `framer-motion` for the transitions) — animated welcome walkthrough, separate content for owner (`ownerTourSteps.js`) and tenant (`tenantTourSteps.js`). Shows automatically the first time each person logs in (tracked in `localStorage`, per `uid`), and there's a **Help** button in both headers to replay it anytime.

**Not yet built:** nothing — every module from your original spec is done.

**Note on existing houses:** the `directory` mirror only gets created/updated going forward (on create/book/vacate/visibility-toggle). If you add houses before this update reaches production, run a one-time backfill — happy to write a small script for that when you're ready to deploy.

## File structure

Each feature lives in its own file under `/src/modules/owner`, `/src/modules/tenant`, or `/src/modules/shared`, backed by one service file per domain in `/src/services`. Updating "just rent" or "just houses" means touching one file.

Server-side code (things that need the Cloudinary API secret or the Firebase Admin SDK) lives outside `/src` entirely, in `/api` (one file per Vercel serverless function) and `/lib` (shared Admin SDK setup). None of it ships to the browser.
