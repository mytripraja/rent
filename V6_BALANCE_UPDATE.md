# V6 — Balance update

This release finishes the remaining implementation gaps from V5 and removes demo-style behaviour.

## Completed
- Analytics no longer uses random occupancy, reliability or delay values.
- Year-end summary uses recorded rent payments, expenses, occupancy history, EB/water collections and complaint records.
- Monthly report uses historical occupancy, approved rent payments and actual EB/water payment records.
- Utility collections are shown separately from the operating result so pass-through collections are not treated as rental profit.
- Property switching no longer advertises an unfinished “coming soon” feature. A single configured property is shown normally; switching is only exposed when more than one property is already configured.
- SMS no longer falls back silently to WhatsApp. It reports clearly that SMS requires a server-side provider configuration.
- Dashboard wording was simplified to use ordinary property-management language rather than product-marketing phrases or synthetic “health” scores.
- The remaining mock/stub implementation comments were removed from application code.

## Verification
- JavaScript service files pass `node --check`.
- A full Vite build still requires dependency installation in an environment with network access; the source package itself has not been represented as build-verified when that install is unavailable.
