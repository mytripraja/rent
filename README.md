# Rental Manager — MVP

Core built: **Owner/Tenant auth · House profiles (create/book/vacate) · Rent submission + approval flow (UPI/bank/cash/neighbor) · EB bill split calculator with redistribution + own-meter opt-out**

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

## Firestore Security Rules (draft — tighten before going live)

You'll want rules so:
- A tenant can only read/write their own house's rent payments
- Only the owner role can approve/reject payments, create/vacate houses, create EB bills
- Aadhaar/ration card storage paths are owner-read-only

I haven't written these yet — flag it and I'll add `firestore.rules` + `storage.rules` next, before you put real tenant data in.

## What's built vs. what's next

**Built (this MVP):**
- Owner: house grid (occupied/vacant), create house, book house (creates tenant login), vacate house (advance return fields), rent approval queue (cash/neighbor-aware)
- Tenant: rent submission (UPI/bank/cash/neighbor + screenshot upload), rent history with status badges
- EB bill split logic (`ebBillService.js`) — ready, just needs a UI screen

**Not yet built** (from the full spec doc) — tell me the order you want:
- EB Bill Creator + tenant EB payment screen (logic is done, needs UI)
- Notices (pinned, color-coded)
- Complaints (tenant→owner, owner→houses)
- Community message board
- Directory (neighbor contact list, phone-hide toggle)
- Service contacts (EB office, mechanic, electrician, Google Maps links)
- Rent revision announcement banner
- Document upload (Aadhaar/ration card) + consent signature
- Owner-assisted manual entry screen (logic exists in rentService via `uploadedByOwner` flag, needs its own simple UI)
- Onboarding tour + animations
- Cloud Function for the 1-hour access-revoke-after-vacate timer (currently just stores the timestamp; the actual revoke needs a scheduled function)

## File structure

Each feature lives in its own file under `/src/modules/owner`, `/src/modules/tenant`, or `/src/modules/shared`, backed by one service file per domain in `/src/services`. Updating "just rent" or "just houses" means touching one file.
