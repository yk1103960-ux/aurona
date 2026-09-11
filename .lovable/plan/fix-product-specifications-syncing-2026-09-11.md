# Fix product specifications syncing

## Changes
- Make the existing admin specifications parser accept common `Label: Value`, `Label = Value`, and `Label - Value` formats instead of silently discarding valid-looking lines.
- Show a clear save error when a specification line has no label/value separator, so an empty table cannot be saved accidentally.
- Keep the existing product table and database fields; no schema or unrelated UI changes.
- Ensure the storefront product query refreshes saved product details rather than holding an old specifications table for five minutes.

## Verification
- Run the TypeScript check.
- Confirm the existing saved family values are read from the same field rendered in the product specifications table.
