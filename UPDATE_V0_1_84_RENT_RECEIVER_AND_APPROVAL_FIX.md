# Rental Manager v0.1.84 — Rent entry and approval fixes

- The existing `RENT-ARN-YYYYMMDD-######` application reference is retained.
- Manual rent entry now records **who received the rent** for Cash, UPI, and Bank Transfer. Choosing “Others” lets the owner enter a receiver name.
- Receiver, payer, and optional notes are saved to the rent payment record.
- Pending approvals and approval history show receiver, payer, and notes when present.
- Removed the approval queue’s automatic calculated late-fee label. The approval screen now shows the submitted payment amount without presenting an unapproved estimate as an added fee. No fee is added to `amount` by this change.

## Important existing data note
The resident’s master rent amount is stored in Firestore house data, not in this source patch. If Sulochana’s current agreed monthly rent is ₹5,500, update House F5’s rent amount in the house/profile settings from ₹5,000 to ₹5,500 as a separate data correction. This patch does not silently modify production tenant data.

Build could not be run in this environment because Vite dependencies were not fully available after the install attempt.
