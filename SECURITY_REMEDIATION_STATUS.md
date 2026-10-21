# Security remediation status — v0.1.89

## Applied in this archive
- Removed `api_dump.txt` from the distributable source archive. `.gitignore` excludes it going forward.
- Removed `'unsafe-eval'` from the report-only Content Security Policy because a source scan of `src/`, `api/`, `lib/`, and root JavaScript did not find direct `eval()` or `new Function()` use. Keep the policy in Report-Only until tested in a browser against Firebase, reCAPTCHA/App Check, Cloudinary, and all normal workflows.
- The existing `apiRateLimits` Firestore-backed throttling helpers and tenant utility bill endpoint are retained.
- Capacitor Android/Core/CLI are pinned by the lockfile to 6.2.2, the fixed version stated in the referenced advisory.

## Still requires a connected Git checkout
This archive does not include `.git` metadata, so it cannot untrack `api_dump.txt` from the remote repository or create a commit. From a real clone, run:

```bash
git rm --cached --ignore-unmatch api_dump.txt
git add .gitignore vercel.json SECURITY_REMEDIATION_STATUS.md
git commit -m "security: untrack API dump and tighten CSP"
git push
```

If `api_dump.txt` should be absent from the working tree too, `git rm --ignore-unmatch api_dump.txt` may be used instead of `git rm --cached`.

## Dependency audit status
Dependency findings are **not verified as resolved**. `npm audit` could not reach `https://registry.npmjs.org/` in the build environment (DNS/network failure), so no safe dependency graph update or fresh audit result was possible. On a machine with registry access, run:

```bash
npm ci
npm audit
npm audit fix
npm audit
npm run build
npm test
```

Review any remaining fixes individually. Do not use `npm audit fix --force` on production without a branch, tests, and a review of major-version changes—especially `firebase-admin`, `@grpc/grpc-js`, and Firestore-related packages. Commit both `package.json` and `package-lock.json` after successful testing.

## App Check rollout
`FIREBASE_APPCHECK_ENFORCED=false` remains intentionally unchanged. Verify that the deployed client obtains and sends valid App Check tokens for all protected API requests, test with a staging deployment, then set `FIREBASE_APPCHECK_ENFORCED=true` in Vercel and redeploy. Monitor failed requests before considering the rollout complete.

## Validation boundary
This is a source patch, not proof of a production-safe release. No live production test or deployment was performed.
