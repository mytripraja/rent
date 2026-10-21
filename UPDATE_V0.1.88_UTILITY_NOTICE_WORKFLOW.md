# Rental Manager v0.1.88 — Utility & Notice Workflow Update

Base: Rental Manager v0.1.87. Existing data structures and legacy shared EB billing are retained.

## Included
- Water bill cycle can include the fixed ₹250 CCTV SIM recharge as a shared charge.
- Water bill cycle can include an annual building-cleaning collection. The UI checks recorded bill cycles and disables the annual option if a cleaning charge for the current year already exists.
- Notice manager supports creating reusable custom templates, including English/Tamil title and message, category, and default time window.
- Added an EB shutdown template with default 9:00 AM–5:30 PM timing and Tamil copy. Select a template to prefill the notice fields; the date remains selected by the owner.
- EB billing defaults to individual-house entries: select only houses paid/managed by the owner, enter each house amount (₹0 allowed) and unit usage or previous/current readings. Houses marked as paying their own EB are not selected by default. Individual EB bill public links do not show payment details or a payment CTA.
- Existing shared-split EB billing remains selectable for cases where a shared bill is actually used.

## Important
- The annual-cleaning guard is based on recorded bill-cycle data in the active property. It is a UI safeguard, not a server-side transaction lock.
- This environment did not have a usable Vite executable in the v0.1.87 archive. Build verification is attempted separately; do not deploy until the build is confirmed.
