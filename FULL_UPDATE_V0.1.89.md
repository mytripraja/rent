# Rental Manager — v0.1.89 utility and notice update

This is a full project source package based on the supplied v0.1.88 project, not a patch-only folder. Keep a backup of your current project and test with a staging Firebase project before production deployment.

## Included in this package

- Water bill creator includes the ₹250 CCTV SIM recharge charge toggle and annual building cleaning charge, with a same-year duplicate guard.
- EB bill creator supports house-wise bill amounts, unit usage, previous/current readings, and ₹0 amounts; houses marked as paying their own EB bill are excluded from shared-split mode.
- Notice manager supports custom reusable templates and English/Tamil template fields; the EB/power shutdown preset is included in the source.
- Water Approval and EB Approval screens now include an owner-side manual utility payment entry for payments received outside the tenant app. It records the house, bill cycle, amount, date, method, payer/reference note and auto-approves the newly created entry.
- Tenant list has a Share login action that prepares a WhatsApp/copy message with tenant name, house number, login ID and a temporary password typed by the owner. The temporary password is not persisted by this screen; only share it through a channel you trust and ask the tenant to change it after first login.

## Important limitations / deployment checklist

- The manual utility form records a reference note for a WhatsApp screenshot; it does not upload the screenshot file. Keep the original proof securely.
- The requested cross-page unpaid-water/unpaid-EB filters on Houses, Water Bills and EB Bills still require a payment-status reconciliation pass against historical records before they should be relied on for accounting. Do not treat the dashboard as a final ledger until that is tested with your real data.
- The project needs its normal environment configuration and Firebase/Vercel secrets; this archive does not contain private production secrets.
- After extracting, run `npm ci`, `npm run build`, run the test suite, review Firestore rules, then deploy to a preview/staging environment first. Verify existing tenant data and old bill cycles before production rollout.
