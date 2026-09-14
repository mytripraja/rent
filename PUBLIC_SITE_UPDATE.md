# Public website + legal UX update

## What changed
- `/` now shows a polished public landing page on first visit.
- The first public visit is remembered with `localStorage` key `rm_public_visited`.
- On later visits, the root route sends signed-out users directly to `/login`.
- Authenticated users still go directly to their owner/tenant workspace.
- Added `/privacy`, `/terms`, `/acceptable-use`, and `/data-policy`.
- Login was redesigned to match the new visual system.
- Login now asks users to acknowledge Terms + Privacy before authentication.
- Google redirect flow stores the acknowledgement in `sessionStorage` so it survives the redirect.
- Added subtle Framer Motion entrance/hover animations and reduced-motion support.
- Added public-site metadata for sharing/search previews.

## Important legal note
The legal pages are practical product copy, not legal advice or a guarantee of compliance. Before production use, replace/confirm operator identity, contact details, grievance process, retention periods, processor disclosures, and any tenancy-specific terms with a qualified lawyer.

The privacy notice is intentionally written as a standalone, plain-language notice with itemised data categories and purposes, consistent with the direction of India's Digital Personal Data Protection framework. Confirm the final text against the rules and the actual deployed data flows.
