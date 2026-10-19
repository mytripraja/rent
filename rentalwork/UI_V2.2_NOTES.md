# Rental Manager UI 2.2

This release refreshes the application visual system and owner navigation without changing the Firebase data model.

## Design changes
- Replaced the oxblood/aged-paper palette with a modern ink/navy + teal + ivory palette.
- Reworked global cards, borders, inputs, focus states, shadows, scrollbars and typography.
- Replaced the long owner top tab strip with a grouped responsive sidebar.
- Added mobile drawer navigation and a compact mobile bottom navigation.
- Expanded the desktop content area to use available screen width.
- Rebuilt More Tools with Lucide icons, descriptions and cleaner card hierarchy; removed emoji-heavy controls.
- Updated shared Button styling from pill-shaped controls to modern rounded action buttons.
- Preserved the ledger/passbook idea through compact status badges and strong financial typography rather than the old brown visual treatment.
- Added dark-mode tokens for the new palette.

## Functional safety
This UI release intentionally avoids changing Firestore collections, payment calculations or authentication logic. Existing application features remain routed to their existing components.

## Verification
- JSON configuration was parsed successfully.
- Source edits were inspected for balanced JSX delimiters.
- Full `npm ci` / production Vite build could not be completed in the sandbox because dependency installation timed out.
