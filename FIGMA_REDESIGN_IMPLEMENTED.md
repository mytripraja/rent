# Figma-aligned UI pass — v0.1.89

This update applies the first visual implementation pass from the supplied Rental Manager Figma PDF.

## Changes made
- Updated the shared light-mode palette to the Figma direction: #F7F8FA canvas, white surfaces, #17211B text, #166534 forest-green brand, and #16A34A primary actions.
- Aligned borders and shadows to a quieter, flatter property-management UI.
- Changed the owner workspace top bar from a dark banner to a white header with subtle borders.
- Restyled the owner dashboard welcome panel as a white surface, retaining the existing live data and dashboard actions.
- Tuned mobile bottom navigation to use the green active state and a larger touch target.
- Kept existing routes, service calls, payment workflows, Firebase logic, and role checks untouched in this visual pass.

## Verification status
- Automated build and tests have **not** been verified in this environment because dependency installation did not complete and Vite was unavailable.
- Run `npm ci`, `npm run build`, and `npm test` locally before deployment.
- This is an initial shared-shell/dashboard styling pass, not a claim that every Figma screen has been fully implemented.
