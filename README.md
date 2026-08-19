# Rental Manager — MVP

Core built: **Owner/Tenant auth · House profiles (create/book/vacate) · Rent submission + approval flow (UPI/bank/cash/neighbor) · EB bill split calculator + full UI (create cycle, per-house override, approvals, tenant payment) · Security rules · Vacate access-revoke Cloud Function**

## Setup

1. Create a Firebase project → enable **Email/Password Auth**, **Firestore**, **Storage**.
2. Copy `.env.example` to `.env` and fill in your Firebase web app config (Project settings → General → Your apps).
3. In Vercel, add the same variables (with `VITE_` prefix, matching your existing MyTripRaja setup).
4. `npm install`
5. `npm run dev` to test locally, or push to GitHub → Vercel auto-deploys.

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

**Not yet built** (from the full spec doc) — tell me the order you want:
- Notices (pinned, color-coded) — `NoticeBanner.jsx` component exists, needs owner create-screen + tenant feed
- Complaints (tenant→owner, owner→houses)
- Community message board
- Directory (neighbor contact list, phone-hide toggle)
- Service contacts (EB office, mechanic, electrician, Google Maps links)
- Rent revision announcement banner (backend function `updateHouseRent` exists, needs UI)
- Document upload (Aadhaar/ration card) + consent signature
- Owner-assisted manual entry screen (logic exists in rentService via `uploadedByOwner` flag, needs its own simple UI)
- Onboarding tour + animations

## File structure

Each feature lives in its own file under `/src/modules/owner`, `/src/modules/tenant`, or `/src/modules/shared`, backed by one service file per domain in `/src/services`. Updating "just rent" or "just houses" means touching one file.
