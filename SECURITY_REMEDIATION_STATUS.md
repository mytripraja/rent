# Rental Manager v0.1.89 — Security remediation status

## Changes included in this patch

- Capacitor Android, Core, and CLI are set to the patched 6.2.2 release line in `package.json` and the lockfile entries. The registry was unreachable in the patching environment, so npm could not regenerate registry integrity metadata. On a machine with internet access, run `npm install` before deployment so npm refreshes the lockfile metadata, then run `npm audit` and `npm run build`. Do not publish the Android app until `npm audit` confirms the Capacitor advisory is resolved and the native app has been rebuilt.
- Added shared Firestore-transaction-backed server-side request throttling in `lib/firebaseAdmin.js`. Authenticated API calls are limited per user and route; sensitive write routes use a tighter limit. Rate limits return HTTP 429 and `Retry-After` when handled by the API catch block.
- Replaced the in-memory per-instance rate limit on customer-ID resolution with a Firestore-backed IP limit. This works across serverless instances, unlike an in-memory `Map`.
- App Check enforcement remains an explicit production setting. The client already attaches an App Check token when `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is configured. Because this environment cannot inspect the Vercel production environment or verify real tokens, enforcement has intentionally not been switched on automatically.
- Kept the CSP in report-only mode so the site can collect violation reports without unexpectedly blocking app functionality.
- Kept environment files and `api_dump.txt` excluded via `.gitignore`.

## Required deployment steps

1. In an internet-connected checkout, run `npm install` to regenerate `package-lock.json` and integrity metadata, then `npm audit` and `npm run build`.
2. Fix every remaining high/critical audit finding without using `npm audit fix --force` blindly. Test any Firebase Admin major-version changes against all `/api` functions.
3. In Firebase Console, register `rent.deepusiva.com` with reCAPTCHA Enterprise App Check and configure Vercel `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` for the client build.
4. Deploy first with `FIREBASE_APPCHECK_ENFORCED=false`; verify App Check requests from the production client and inspect failures. Then set `FIREBASE_APPCHECK_ENFORCED=true` in Vercel and redeploy server functions. If the client token is missing or invalid, protected API requests will return 401.
5. Test login, tenant bill views, rent submission, owner approvals, uploads, notices, and all mobile/Android flows with test accounts before production rollout.
6. Firestore rate-limit records are stored in `apiRateLimits`. Configure a Firestore TTL policy on `updatedAt` or periodically clean old records to control collection growth; TTL is optional for correctness but recommended operationally.
7. Keep CSP in report-only mode until real browser reports show all required Firebase, reCAPTCHA, Cloudinary, and Vercel endpoints. Then move to an enforced CSP after review.

## Verification limits

The source syntax and JSON configuration can be checked locally, but the npm registry was unreachable in this environment. Therefore the npm dependency tree, complete Vite build, npm audit result, production App Check tokens, and live production behavior have not been verified here. This ZIP is a security-hardening candidate and must pass the deployment steps above before it is considered production-ready.
