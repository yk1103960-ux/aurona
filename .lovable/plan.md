# Simple Add Product → Options → Generate Variations → Table → Save

## GitHub access note

I cannot browse `auradev1212/aurona` directly. What I can read is the synced workspace copy of your project (current local HEAD `1374c37 "Added secure server loader"`, on top of the Phase 2A commit you confirmed earlier). Everything below is based on that synced code, and nothing has been modified.

## 1. Where the product/variation work lives today

| Concern | File |
| --- | --- |
| Add Product | `src/routes/aurona-console-9f2x7k.products.new.tsx` (wraps the editor with `productId="new"`) |
| Edit Product | `src/routes/aurona-console-9f2x7k.products.$id.tsx` (~1470 lines; tabs General/Media/Customer + "More options") |
| Variations screen | `src/routes/aurona-console-9f2x7k.products.$id_.variations.tsx` |
| Variant editor | `src/components/admin/VariantEditor.tsx` (~2586 lines: tabs `quick`/`options`/`customer`/`retailer`/`distributor`/`shipping`, `QuickVariantsTab`, `VariantEditDialog` 6-step wizard) |
| Combination generation | `generateCombinations` in `VariantEditor.tsx`; pure rules in `src/lib/variant-options.ts` (`buildCombinations`, `missingCombinations`, `combinationKey`, `actualAxes`) |
| Row model / validation / duplication | `src/lib/variant-workflow.ts` (`Variant`, `Axis`, `newVariation`, `prepareVariationAxes`, `variationIssues`) |
| Axes + variants read/write | `src/lib/catalog-admin.functions.ts` (`adminLoadVariantMatrix`, `adminSaveVariantMatrix` → RPC `admin_save_variant_matrix_v3/v2/v1`) |
| Pricing & inventory columns | `product_variants` (mrp, price, retailer_price/moq, distributor_price/moq, stock, low_stock_threshold, pack_size, weight/dims) |
| Variant images | `src/components/admin/ProductImageManager.tsx`, `src/lib/variant-photo-drafts.ts`, `src/lib/product-images.ts`, table `product_images` |
| Storefront selection | `src/routes/products.$slug.tsx` + `src/hooks/useVariantSelection.ts` (+ `ProductGallery.tsx`) |
| Shared options page | `src/routes/aurona-console-9f2x7k.products.options.tsx` |

So the architecture the client needs already exists — the problem is purely how much of it the screen shows, and that variations sit on a separate route from Add Product.

## 2. What actually makes it feel complicated

1. Add Product and Variations are two separate pages; a new product must be saved, then reopened, before options can be added.
2. Option values are entered per option with UI controls rather than pasted as a block ("5W, 7W, 9W, 12W").
3. `QuickVariantsTab` shows only code/MRP/price/stock/live/photos — retailer price, distributor price and pack size force a tab switch or the 6-step dialog.
4. Every small change routes through a 6-step wizard (`VARIATION_STEPS`).
5. No bulk fill, no copy-down, and regeneration warnings are minimal.

## 3. The plan (edit existing files only, no second variant system)

**A. One flow, one screen**
- On the product editor, after Basic details, show the same `VariantEditor` inline (Options & Variants section) instead of a separate route. For a brand-new product, save the family silently on first variation action and continue in place, so the admin never leaves the page.
- Keep `/products/$id_/variations` working as-is (deep link), pointing at the same component.

**B. Paste-friendly options block**
- In the options editor, each option row becomes: option name (free text, plus quick chips Wattage / Output Colour / Body Colour / Size / Model / Pack — chips only prefill the name, nothing hard-coded) + one textarea accepting comma, newline or tab separated values.
- Values normalised through existing `prepareVariationAxes` (trim, dedupe, protect values in use).

**C. GENERATE VARIATIONS**
- One prominent button using the existing `missingCombinations` + `generateCombinations`, so existing SKUs are always preserved and never re-created.
- Before generating, show a summary: "12 new combinations will be added, 4 already exist, 0 removed."
- If an option value is deleted while active SKUs use it, show an explicit confirm listing those SKUs; default is keep (current code already throws — we surface it as a clear dialog instead of a raw error).
- SKU auto-naming keeps the current collision-safe `FAMILYSKU-5W-WARM` pattern.

**D. One editable table**
Columns: Variation combination · SKU · MRP · Customer price · Retailer price · Distributor price · Stock · Pack size · Image · Live · Edit.
- Inline editing on every cell (existing `updateRow`).
- Bulk bar above the table: apply a value to all rows or to selected rows (MRP, customer/retailer/distributor price, stock, pack size, live) — applies to the in-memory draft only, saved by the existing Save button.
- "Copy down" on a cell to fill the rows below with the same value.
- Advanced edit (dimensions, weight, barcode, MOQ, thresholds, SEO-ish extras) stays in the existing dialog, reachable from the row's Edit action, no longer the default path.
- Image button per row keeps using `ProductImageManager` with the row's SKU, so per-SKU images and primary-image behaviour are unchanged.

**E. Save**
- Single "Save product & variations" using existing `adminSaveVariantMatrix`; validation continues through `variationIssues`, with errors listed per row above the table.

**F. Storefront**
- No change needed: `useVariantSelection` + variant images already resolve SKU, price, stock and images from the axes. I will smoke-check one multi-axis product after the change.

## 4. Guardrails
- No new tables, no new RPCs, no second editor component, no schema migration.
- No product, price, stock or image data touched; the pending parity migration stays unapplied.
- Old-site values are only used where they already exist in this database; nothing invented.
- Advanced/partner pricing stays visible in the table but remains protected by the existing server-side permission checks.

## 5. Technical notes
Main edits: `VariantEditor.tsx` (options block, generate summary, expanded quick table, bulk/copy-down), `aurona-console-9f2x7k.products.$id.tsx` (inline variations section + first-save handoff), small helper additions to `variant-options.ts` / `variant-workflow.ts` with unit tests appended to the existing `.test.mjs` files. `catalog-admin.functions.ts` unchanged unless save needs the family-create handoff.

Waiting for your authorization before touching any file.
