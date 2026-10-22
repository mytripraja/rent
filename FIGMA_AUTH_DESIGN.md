Rental Manager — Figma authentication design

This package implements all 11 authentication frames from the linked Figma page in the existing React app. Open /login to view the sign-in design; the root route can show the separate public welcome page first.

Implemented states:
- Sign in with visible/hidden password, input validation, invalid credentials and retry feedback
- Forgot-password request plus secure Firebase reset-link screen, matching-password validation and completion
- Login processing and role-based success confirmation before workspace redirect
- Session-expired and access-denied states with safe return to the correct workspace
- Existing Customer ID, Google sign-in, legal consent, MFA and account lockout flows

To run locally:
  npm ci
  npm run dev
Then open http://localhost:5173/login.
