# Rental Manager security patch notes

Patched from the supplied v0.1.89 ZIP.

## Changes made
- Restricted direct Firestore reads of `ebBills` and `waterBills` to authorized owner-level accounts. Firestore rules cannot redact individual fields from a bill document, so tenants now load their utility bill through `/api/tenant-utility-bills`.
- Added `/api/tenant-utility-bills`, which derives the tenant UID and house from the verified Firebase ID token and returns only that tenant's own share. The caller cannot choose another house ID.
- Updated the water/EB bill service functions to use the tenant-safe endpoint for tenant accounts while retaining existing owner queries.
- Added a `Content-Security-Policy-Report-Only` header as a monitoring-first CSP rollout; it does not yet block resources.
- Broadened `.gitignore` to exclude all `.env*` files except `.env.example`, and excluded generated `api_dump.txt`.

## Not completed / must be verified before production
- `npm audit` could not reach the npm registry in this environment (`EAI_AGAIN registry.npmjs.org`). No dependency upgrades were guessed or written into the lockfile. In particular, the supplied lockfile resolves `@capacitor/android` and `@capacitor/core` to 6.2.1, below the report's 6.2.2 minimum. Run `npm audit fix` and verify the Capacitor/Firebase dependency tree on a networked machine, then test the Android build.
- The CSP is Report-Only and intentionally needs review against browser reports before enforcement.
- App Check remains optional until the reCAPTCHA Enterprise site key is configured and production traffic confirms valid App Check tokens. Only then set `FIREBASE_APPCHECK_ENFORCED=true` in Vercel.
- A general-purpose server-side rate limit was not added to every endpoint; doing so safely requires endpoint-by-endpoint traffic thresholds and tests. The existing client cooldown is not a security boundary.
- This was a static patch and syntax/JSON check, not a live penetration test or production deployment.

## Validation performed
- `node --check` passed for the new API endpoint and the modified water/EB service modules.
- `package.json`, `package-lock.json`, and `vercel.json` parsed as valid JSON.
- Full Vite build and automated test suite were not run because dependencies are not installed and the npm registry was unreachable.
