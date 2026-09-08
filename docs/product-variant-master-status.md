# Product detailing / variants — 2026-09-08

Status: PARTIAL IMPLEMENTATION; NOT RUNTIME VERIFIED. No production writes or migrations applied.

## Evidence and mapping

The repository remains family-first: product_families → product_variant_axes → product_variants, with product_images.variant_sku for SKU media. Variant attributes are JSON and are not tied to category names. Pricing uses get_visible_prices; checkout resolves real products.id from the selected SKU and uses atomic order/ledger routines.

The Phase 2A integrity migration links existing families by main_sku and legacy_product_id, creates families for remaining legacy products, and copies wattage/size/color_temp into variant attributes. This is migration-source evidence, NOT a report of current database records. Seed migration values are not proof of the old production catalog and were not used to populate products.

Read-only public references inspected:

- https://aurona.in/search?keyword=Zio
- https://aurona.in/search?keyword=Track+Light
- https://aurona.in/search?keyword=NOVA
- https://aurona.in/search?keyword=Hexa

These retrieved pages expose global filters for Watts Available, Output Colour Option/s, Body Colour/s, Shape, Pack Size, Size Option/s and Reflector Colour. They do not expose product-specific SKU combinations in the retrieved content. No global filter values were assigned to products. Output colour and housing colour remain distinct.

Supabase URL, publishable key and service-role configuration are absent from this workspace. Actual per-product mapping, current axes, collisions, unmapped attributes and live SKU counts are UNKNOWN. Use product-variant-data-audit.sql for a read-only inventory before any mapping. An authorized old-catalog export with SKU, actual attributes, role prices, stock and image associations is required to finish data mapping. Do not paste secrets into chat.

## Implemented in this change

- Generation takes only explicitly supplied/selected values; no prefilled wattage values.
- Bounded Cartesian expansion, duplicate-value cleanup and collision-safe combination keys.
- Existing rows are never overwritten, deleted or assigned options by generation.
- New rows have no copied prices or measurements and start inactive with zero stock.
- One option box, inclusion checkboxes, Save & Generate, All Variants, individual Edit Variant and Images actions.
- Selected-SKU bulk draft edits for prices, dimensions, weight, pack size, low-stock threshold and active status. Stock quantities are intentionally excluded from bulk assignment.
- Optional variant label, display order and arbitrary SKU-specific specifications in the existing attributes object.
- Saved axis keys cannot be casually renamed; removing used axes/values is blocked by the editor.
- New rows cannot silently adopt another persisted variant just because the SKU matches. Save Options refetches persisted IDs before generation.
- Photo load errors surfaced; image upload requires an existing SKU. Removing an image association retains potentially shared files. Reassignment clears primary status to avoid carrying it into another scope; choose Set primary in the new scope.
- Storefront option values derive from real variant attributes; impossible choices do not mutate selection. Displayed selection follows the actual selected variant, including missing values. Families without variants show an unavailable state.
- Seven pure regression tests (synthetic fixtures only, no catalog data inserted).

Checks run: local TypeScript no-emit check passed; production build passed (existing deprecation warnings); all seven regression tests passed; diff whitespace check passed. SQL has been reviewed statically but not executed or database-validated.

## Unapplied migration

20260908130000_variant_save_safety.sql adds service-role-only admin_save_variant_matrix_v3. It wraps the existing v2 save, locks rows, rejects duplicate/foreign SKU identities and negative measurements/prices, and uses admin_adjust_inventory for stock changes. Stock edits compare the value originally loaded, rejecting stale edits; non-stock saves retain live stock.

Requires 20260906190000_phase2a_catalog_integrity.sql and 20260907160000_product_admin_parity.sql plus the existing migration chain. Inspect the target migration history; never rerun old migrations blindly. The editor now fails clearly if v3 is absent, rather than using direct stock writes. Existing v1/v2 callers are retained for backward compatibility, so this is NOT a complete inventory-write audit.

Saved SKU renames are intentionally blocked by v3: image associations, cart references and legacy product mappings need an explicit transactional identity migration. New draft SKU values remain editable. No existing SKU is rewritten automatically.

## Outstanding implementation / integration risks

- Actual old-product mapping and category-wide data coverage remain incomplete until the source export and authorized database inspection are available.
- The prepared v3 migration creates missing products.id compatibility projections when a family matrix is saved, preserving existing IDs/slugs. It does not populate or regroup the entire catalog on migration application. Verify cart mapping for every generated SKU in staging before activation.
- The migration extends the existing refresh_product_family routine to project each SKU's price/stock/measurements onto its legacy row, while keeping family totals on product_families. Verify existing cart and legacy consumers, especially the main SKU, in staging.
- Other legacy matrix callers and family saves need database-backed concurrency verification; this change hardens the VariantEditor entry point, not every write path.
- The image manager's reassignment/removal/primary replacement is not one transaction. Concurrent image operations and failure recovery still require runtime validation and potentially a dedicated atomic image routine.
- Cross-session realtime delivery depends on Supabase publication/RLS and is not verified. No claim of universal realtime synchronization.
- Edit Variant operates on the shared draft list; Close editor retains draft edits, and Save All Variant Changes explicitly saves the matrix.

## Required runtime acceptance (each family)

Choose real Concealed, Track, Flood and one different-axis lighting family from the authorized data; do not manufacture test specifications. Run writes only on a safe test database.

| Check | Concealed | Track | Flood | Different-axis family |
| --- | --- | --- | --- | --- |
| Source attributes and existing IDs/SKUs mapped | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Family opens, options are correct, each SKU editable | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Selected-value generation; repeat creates no duplicates | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Prices/MOQs, measurements and custom details survive reload | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Bulk edit affects selected SKUs only | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Stock edit has one ledger entry; stale edit rejected | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| SKU image upload/reorder/reassign/remove/primary/fallback | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Storefront selects real SKU; price/stock/images update | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Inactive/unavailable combinations cannot be bought | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| Selected SKU reaches cart; correct role price at checkout | REQUIRED | REQUIRED | REQUIRED | REQUIRED |

Also test missing migration, network failures, two concurrent editors, simultaneous stock reservation, shared photo removal, archived SKU collision, a family with zero active variants, mobile layout and keyboard interactions. Check existing orders/URLs remain intact. Build success does not satisfy these runtime requirements.
