# Product form preservation on window switch

## Cause and changes

Supabase auth events can supply a new `User` object for the same account. The
admin hook previously reset its role result to `null` for each new object.
`AdminShell` then replaced its outlet with the verification screen, unmounting
product and variation editors and discarding their in-memory state.

The role decision now belongs to a specific user ID. Same-account revalidation
keeps the editor mounted while the existing role query completes. A different
account must pass its own verification before the outlet renders. Sign-out,
missing roles and failed role queries still deny access; cancelled requests
cannot update the decision. Server authorization and account-status checks are
unchanged.

New-product drafts also flush to existing browser storage on window blur, hidden
tab and page exit, in addition to the existing debounce/unmount persistence.
The existing dirty/cleared guards prevent a successful save or Clear draft action
from being undone by a delayed write. No database changes or migration is needed.

## Verification

- TypeScript check and production build passed.
- 29 regression tests passed, including five isolated tests executing the actual
  admin hook with deferred role responses: repeated same-account auth events,
  account switching, stale responses, sign-out and role/query failure.
- Hook and regression-test lint passed. The product route retains its ten
  pre-existing `no-explicit-any` errors; no new lint failures were introduced.
- No production data was changed, migrations applied, or changes merged to main.

## Runtime acceptance still required

An authenticated Supabase-backed browser was not available for this fix. These
are pending checks, not completed verification:

1. In Add New Product, enter name, SKU, category, prices and descriptions. Switch
   to another window immediately after typing, return, and confirm all values and
   the selected editor tab remain intact without a verification-screen flash.
2. Repeat while editing an existing product and an unsaved variation, including
   a selected image, attributes and customer/retailer/distributor prices. Confirm
   a successful same-user token refresh leaves the editor mounted.
3. For a new product, switch away before the 400 ms debounce, then reload. Confirm
   the persisted draft restores. Clear the draft, switch away/reload, and confirm
   it stays empty. Enter a fresh category/value and verify only the new draft
   returns. Browser storage must be available for reload recovery.
4. In an authorized test environment, save a new product successfully and confirm
   returning to Add New Product does not restore that saved draft.
5. Test genuine sign-out, expiry, role removal and account switching. Access must
   remain protected; another account must never inherit an admin role decision.
6. Test transient connection failures and reconnection. Failed authorization still
   closes protected content; this fix does not bypass that security behavior.

This fixes editor remounting on successful session refresh. It does not add
durable storage for unsaved variation image files or existing-product edits
across a full browser reload, genuine logout or failed authorization.
