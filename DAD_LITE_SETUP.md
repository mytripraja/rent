# Dad Lite — Simple Rent Collection

This version adds a simple rent-collection screen for an owner account that only needs to record which tenant paid.

## Turn it on for Dad

1. Sign in with the Super Admin account.
2. Open **More → Owner Management**.
3. Find Dad's owner account.
4. Press **Full** to change it to **Simple**.
5. Dad logs out and signs in again. His account will open the simple **Rent Collection** screen automatically.

## Dad's screen

- Shows only occupied houses and tenant names.
- Defaults to the current month.
- Each unpaid tenant has one large **Paid Rent** button.
- The payment form defaults the date to today.
- Rent amount defaults to the house's configured monthly rent but can be corrected before submission.
- Receiver options: Deepu, Rajavel, Dada, Siva, Brother, Others.
- Entries are submitted as cash/manual owner entries and marked `entrySource: dad_lite`.
- Dad cannot approve/reject the submitted rent from Firestore; approval remains with a non-lite owner/admin account.
- Until approval, the tenant's rent is shown as waiting rather than paid.

## Important

Deploy the updated `firestore.rules` as well as the web application. The rule prevents a `dad-lite` owner account from updating or deleting rent payment documents, so the approval step remains with the main/admin account.
