# Rental Manager — MVP

Core built: **Ledger design system (passbook-inspired: paper/ink/brass palette, rubber-stamp status badges, serif/mono type pairing) applied across every screen including modals and forms · Multi-owner accounts (super-admin + co-owners) with audit trail on every entry · Owner/Tenant auth (email/password, Google, Customer ID) · Bank-style unique Customer ID system · House profiles (create/book/vacate, one-time Setup + everyday Houses tab split) · Tenants section (All/Current/Old/Rent Pending) with full tenant profiles · Editable tenant contact info · Partial advance payment ledger · Rent submission + approval flow (UPI/bank/cash/neighbor) · Owner-assisted manual entry · Customizable per-house rent revision · EB bill split calculator + full UI · Pinned color-coded notices · Complaints (tenant→owner private, owner→house targeted) · Directory (neighbors + vacant houses, phone-hide toggle) · Service contacts (click-to-call, Google Maps links) · Document verification (Aadhaar/ration card + consent signature, private Cloudinary storage) · Community message board · Owner profile + photo · Global search · Home dashboard with live stats · Animated onboarding tour · Security rules · Vacate access-revoke sweep · Mobile-responsive layout · Android packaging (Capacitor)

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

House creation lives under **More → Property Setup**, separate from the everyday **Houses** tab — since you said you'll only add the 13 houses once, not routinely. **Houses** stays focused on booking/vacating/occupancy.

## Create your admin account (do this first)

There's no signup UI on purpose (no random signups). Create your own account — as the **super-admin**, not a regular owner — by running this once in the browser console on the login page:

```js
import { createOwnerAccount } from './services/authService'
await createOwnerAccount({ email: 'you@example.com', password: '...', name: 'Deepu' })
```

This is a one-time bootstrap step. Every co-owner added after this goes through **More → Owner Management** instead (admin-only), which uses `api/create-owner.js` so adding them doesn't log you out.

## Multi-owner accounts (super-admin + co-owners)

- **You (super-admin)**: the only one who can add or remove other owner accounts, via **More → Owner Management**.
- **Co-owners** (dad, brother, mom, staff, etc.): everything else — houses, rent, EB bills, notices, complaints, documents, community — is identical access to yours. `firestore.rules`' `isOwner()` now means "admin OR owner," while a separate `isAdmin()` gates account management specifically.
- Every co-owner gets their own login and their own profile photo (**More → My Profile**, or the avatar in the header).

## Who did what — audit trail

Every rent/EB payment now records **`recordedBy`** (who submitted it — the tenant, or whichever owner used Manual Entry) and **`actionedBy`** (who approved/rejected it). Shows as "Entered by [name]" in the approval queues. Useful once more than one person is touching the app — you'll be able to tell your entries apart from your brother's or mom's.

## Tenants section

A new **Tenants** tab, separate from **Houses** (which stays focused on occupancy/vacancy management):

- **All / Current / Old / Rent Pending** filter tabs. "Old" pulls every past occupant across all houses via a Firestore collection-group query on each house's `history` subcollection — **the first time this runs, Firestore will show a "create index" link in the browser console error; click it once and it's done** (composite index on `movedOutAt`, one-time setup).
- "Rent Pending" shows name, photo, and how many consecutive months they're behind (`countMonthsPending()` in `rentService.js` — walks backward from the current month until it finds an approved payment).
- Clicking any tenant opens their full profile: contact info (with an **Edit** button — see below), move-in date, rent, the advance-payment ledger, full rent history, and — if the house has had previous occupants — their history too.
- The global **search bar** in the owner header (name, door number, or phone) jumps straight into a tenant's profile from anywhere in the app.

## Editing tenant contact info

From a tenant's profile, **Edit** next to Contact Info lets you change their email or phone. Email changes go through `api/update-tenant-contact.js` — a client can't change another Firebase user's login email directly, so this runs through the Admin SDK and keeps their `users`, `houses`, and `directory` records in sync in one call.

## Partial advance payments

Booking a house now asks for the **agreed advance amount** (target) separately from **advance paid now** (what they're actually handing over that day — can be less, e.g. ₹5,000 of a ₹10,000 target). The rest gets added later from the tenant's profile via **Add Payment**, which logs to a running ledger (`advanceLedgerService.js`) rather than overwriting a single number — so you keep a full history of who paid what, when, and by which mode, and the profile shows "Collected ₹X of ₹Y agreed."

## Rent Revision — now customizable per house

Moved into **More → Rent Revision** (used once or twice a year, so it doesn't need a permanent tab). Redesigned to handle your actual case — different increases for different houses in one go: tick the houses going up, type each one's *own* new amount (₹500 for one, ₹1,000 for another, whatever), pick one effective month for the batch, and announce them all together. Each house still gets its own pending-revision banner and its own "Apply now" button on your side.

## Security rules + serverless functions (now included)

- `firestore.rules` — owner has full access; tenants can only read/write their own house's rent and EB payments, read (not write) their own house doc, and read/create their own complaints. Notices and the community board are readable by anyone signed in.
- `api/create-tenant.js` — creates a tenant's Firebase Auth account + Customer ID via Admin SDK, without disturbing the caller's session.
- `api/create-owner.js` / `api/delete-owner.js` — admin-only: add/remove co-owner accounts.
- `api/update-tenant-contact.js` — owner-level: edit a tenant's email/phone (email changes need the Admin SDK since a client can't change another user's Auth email).
- `api/sign-upload.js` / `api/get-signed-url.js` — sign private Cloudinary uploads and mint short-lived view links for Aadhaar/ration card documents (see the Cloudinary section above).
- `api/revoke-vacated-access.js` — disables a vacated tenant's login once their 1-hour access window passes. Triggered by the GitHub Actions schedule, not Vercel cron (see above for why).
- `lib/firebaseAdmin.js` — shared Admin SDK setup + auth-checking helpers (`requireAuth`, `requireOwnerLevel`, `requireAdmin`) used by all the functions above.

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

## Packaging as an Android app (Capacitor)

Same approach as MyTripRaja. `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` are already installed, and a full native Android project has been generated at `/android` (verified — `npx cap add android` was actually run, not just described; the project builds against the real Capacitor toolchain, package name `com.rds.rentalmanager`).

**How it's wired:** `capacitor.config.json` points the app's WebView at your **live Vercel deployment** rather than bundling the static files into the app. This matters here specifically because of the `/api` routes and Firebase Auth — bundling static files would mean the app runs from a `capacitor://` or `file://` origin, which Firebase Auth doesn't recognize and which can't reach `/api/*` without extra CORS setup. Pointing at the real HTTPS domain sidesteps both problems entirely: the app is essentially a dedicated browser window into your already-deployed site.

**Before building:**
1. Open `capacitor.config.json` and replace `REPLACE-WITH-YOUR-VERCEL-DOMAIN.vercel.app` with your actual deployed domain.
2. Firebase Console → Authentication → Settings → Authorized domains → make sure that same domain is listed (it already should be, from setting up Google Sign-In on the web).
3. Run `npm run cap:sync` to rebuild the web assets and sync them into the native project.

**To build and test:**
- Install [Android Studio](https://developer.android.com/studio) (needed for the Android SDK — not something that can run in this environment, so you'll do this step locally).
- `npm run cap:android` — builds the web app, syncs it, and opens the project in Android Studio.
- From there: Run ▶ on an emulator or your phone over USB, or Build → Generate Signed Bundle/APK when you're ready for the Play Store.

**One thing to test carefully once it's running:** Google Sign-In inside a native WebView can't use the popup flow — `authService.js` already detects this (`isLikelyInAppBrowser()`) and falls back to redirect, but Capacitor's WebView doesn't always identify itself the same way a mobile browser does. If Google Sign-In doesn't work smoothly on first test, the fix is either adjusting that detection or switching to the dedicated `@capacitor-firebase/authentication` plugin, which handles native Google Sign-In properly — flag it and I'll wire that in.

**App icon and splash screen:** still the Capacitor defaults. `npx @capacitor/assets generate` can generate a full icon/splash set from a single source image once you have one ready.

## File structure

Each feature lives in its own file under `/src/modules/owner`, `/src/modules/tenant`, or `/src/modules/shared`, backed by one service file per domain in `/src/services`. Updating "just rent" or "just houses" means touching one file.

Server-side code (things that need the Cloudinary API secret or the Firebase Admin SDK) lives outside `/src` entirely, in `/api` (one file per Vercel serverless function) and `/lib` (shared Admin SDK setup). None of it ships to the browser.
