# Rental Manager — Figma redesign pass 3

## Scope
This pass applies a shared visual system across the existing owner and tenant screens, rather than changing only the dashboard or Houses page. It is intentionally a presentation-only update: routes, Firestore calls, Firebase authentication, role checks, rent/bill calculations, submission and approval workflows, and feature components have not been rewritten.

## Design tokens
- Forest-green anchors: `#166534` / deep green `#14532D`
- Primary actions: `#16A34A`, hover `#15803D`
- Pale-green support surfaces: `#E8F5EC` / `#F0F7F2`
- Canvas: `#F5F7F8`; surfaces: `#FFFFFF`
- Text: `#17211B`; secondary text: `#64748B`
- Neutral borders: `#E2E8E4` / `#CBD5CE`

## Included
- Rebalanced house cards to use the deeper forest-green header and white high-contrast text; status badges remain pale semantic chips.
- Standardized primary action buttons, forms, focus rings, cards, tables, dialog surfaces, and status stamps.
- Applied the same presentation rules to shared owner/tenant shell and mobile navigation.
- Added mobile-width safeguards for grids, forms, overflow tables, and touch targets.
- Kept the owner dashboard live data and all existing feature logic intact.

## Important scope note
This is a broad shared-style implementation pass, not a claim that every Figma frame has been individually recreated pixel-for-pixel. Components with bespoke inline styling may need additional screen-specific refinement after running the app and comparing each screen with the Figma board.

## Verification
Run in the project directory:

```bash
npm ci
npm run build
npm test
```

Then smoke-test owner and tenant login, house details, manual rent entry, tenant rent submission, rent approvals, EB/water bills, notices, maintenance, and settings before deploying. No production deployment is performed by this archive.
