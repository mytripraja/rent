# Rental Manager — MVP

Core built: **Owner/Tenant auth (email/password, Google, Customer ID) · Bank-style unique Customer ID system · House profiles (create/book/vacate) · Rent submission + approval flow (UPI/bank/cash/neighbor) · EB bill split calculator + full UI · Pinned color-coded notices · Complaints (tenant→owner private, owner→house targeted) · Security rules · Vacate access-revoke Cloud Function · Mobile-responsive layout**

## Setup

1. Create a Firebase project → enable **Email/Password Auth**, **Google Auth** (Authentication → Sign-in method → Google → Enable, set a support email), **Firestore**, **Storage**, and **Functions** (needs the Blaze pay-as-you-go plan — the free tier covers this app's usage easily).
2. Copy `.env.example` to `.env` and fill in your Firebase web app config (Project settings → General → Your apps).
3. In Vercel, add the same variables (with `VITE_` prefix, matching your existing MyTripRaja setup).
4. `npm install`
5. `npm run dev` to test locally, or push to GitHub → Vercel auto-deploys.
6. `cd functions && npm install`, then from the project root: `firebase deploy --only firestore:rules,storage:rules,functions`

## Login — 3 ways

- **Email + password** — normal Firebase Auth
- **Customer ID + password** — the ID looks like `RM1001`. Login resolves the ID to the linked email (via a public `customerLookup` doc containing only that email), then signs in normally.
- **Google** — works if the tenant's Google account email matches the email on file. If they already have a password login under that email, Firebase will ask them to sign in with the password once and link Google from there (handled — see `linkGoogleToCurrentAccount()` in `authService.js`).

## Customer ID system

Every tenant gets a unique ID (`RM1001`, `RM1002`, …) the moment their account is created — same idea as a bank customer ID. If the same person (matched by Aadhaar number) rents a second house later, they keep their existing ID instead of getting a new one; both houses link under it via `linkedHouseIds` on their `customers/{id}` doc.

**Important implementation detail:** creating a tenant's login now goes through a Cloud Function (`createTenantAccountAdmin`) instead of the client SDK. If it were done client-side, Firebase Auth would silently switch your owner session over to the newly created tenant the moment their account is made — you'd get logged out mid-booking. The function uses the Admin SDK so your session is untouched.

## Create your owner account

There's no signup UI yet on purpose (you don't want random signups). Create the first owner account by running this once in the browser console on the login page, or I can add a one-time setup script — tell me which you'd prefer.

```js
import { createOwnerAccount } from './services/authService'
await createOwnerAccount({ email: 'you@example.com', password: '...', name: 'Deepu' })
```

## Security rules + Cloud Functions (now included)

- `firestore.rules` — owner has full access; tenants can only read/write their own house's rent and EB payments, read (not write) their own house doc, and read/create their own complaints. Notices and the community board are readable by anyone signed in.
- `storage.rules` — rent/EB proof screenshots are readable by any signed-in user (tenants need to see their own, owner needs to see all). Aadhaar/ration card uploads under `private-documents/` require an `owner` custom claim to read — Storage rules can't query Firestore directly, so this claim is what makes owner-only access work.
- `functions/index.js` — three Cloud Functions:
  - `setRoleClaim` / `syncRoleClaimOnUpdate`: automatically stamps the `role` custom claim on each user's auth token when their `users/{uid}` doc is created or changed. This is what the Storage rule above checks.
  - `revokeAccessAfterVacate`: runs every 15 minutes, finds houses where the 1-hour vacate window has passed, and disables the departed tenant's login. Before this, vacating only removed their data association — their login still worked. Now it's actually enforced.

**Deploy these** (from the project root, with the Firebase CLI installed and logged in):
```
firebase deploy --only firestore:rules,storage:rules,functions
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

**Not yet built** (from the full spec doc) — tell me the order you want:
- Community message board
- Directory (neighbor contact list, phone-hide toggle)
- Service contacts (EB office, mechanic, electrician, Google Maps links)
- Rent revision announcement banner (backend function `updateHouseRent` exists, needs UI)
- Document upload (Aadhaar/ration card) + consent signature
- Owner-assisted manual entry screen (logic exists in rentService via `uploadedByOwner` flag, needs its own simple UI)
- Onboarding tour + animations

## File structure

Each feature lives in its own file under `/src/modules/owner`, `/src/modules/tenant`, or `/src/modules/shared`, backed by one service file per domain in `/src/services`. Updating "just rent" or "just houses" means touching one file.
