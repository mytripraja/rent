# Rental Manager V4 — House Details + Household Accounts

## UX changes
- Removed the regular `Mark Vacate` action from occupied-house cards. Vacating is now a deliberate action inside the house detail view.
- Clicking a house opens a responsive house profile with Overview, Residents, Rent history and Occupancy history.
- House profiles show current tenant, move-in date, household member count, rent, advance, EB number, approved rent total and past occupancy records.
- Booking now records household member count (1–20).
- Owner overview now prioritizes daily operations, follow-ups, notices and useful workflow tools instead of vacancy information.
- Mobile bottom navigation is constrained to five compact items and uses safe-area spacing to avoid label wrapping.

## Household / family accounts
- Every booked house has one primary tenant account.
- A primary tenant can create up to 5 separate family/sub accounts.
- Owner/admin can also create and manage family accounts from the house's tenant profile.
- Family account fields: name, relationship, email, phone and password.
- Each family account has independent permissions for rent, bills, notices, complaints, maintenance, visitors, common-area booking, documents, directory and community.
- Primary tenant remains the household controller. Sub-accounts cannot create/manage other accounts.
- Owner/admin can edit permissions, disable/enable or remove a family account.
- When a house is vacated, the scheduled access-revocation job also disables all family sub-accounts for that house.

## Security / data notes
- Family account creation and management use server-side Admin SDK endpoints, so creating a family login never signs the primary tenant or owner out of their current browser session.
- Firestore tenant access is permission-aware for the major household data collections.
- EB and water bill documents now include `houseIds`, and tenant clients query only bills containing their house. Existing legacy bill documents may need a one-time backfill with `houseIds` before those bills can be displayed to tenants under the tightened rule.
- The primary tenant is treated as primary for backward compatibility when an existing `users/{uid}` document has no `accountType` field.
