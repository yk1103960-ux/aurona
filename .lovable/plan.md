
# Aurona — Parent/Child SKUs + PDP Variation Switching (Part 1)

The current site keeps every SKU as an independent product. The uploaded workbook actually has 70 parent products with up to 9 variation axes (Watt, Output Colour, Body Colour, Shape, Pack Size, Oscillation, Tank Capacity, Size, Reflector Colour) → ~427 child SKUs. This plan wires that structure in without changing the current UI/UX, then adds the highest-value enhancements from your brief. Deeper items (admin dashboard, downloads library, reviews, brand pages, blogs CMS, etc.) are called out at the end as follow-up passes.

## 1. Data model (migration)

New tables — additive, existing `products` untouched:

- `product_families` — parent record. Columns: `slug`, `name`, `category_id`, `brand`, `main_sku`, `description`, `image_seed`, `is_featured/bestseller/new/sale`, aggregates (`min_price`, `max_price`, `total_stock`).
- `product_variants` — one row per real SKU. Columns: `family_id`, `sku`, `attributes jsonb` (e.g. `{watt:"9W", body_colour:"White"}`), `mrp`, `price`, `retailer_price`, `distributor_price`, `moq`, `stock`, `weight_g`, `dims jsonb`, `pack_dims jsonb`, `image_seed`, `barcode`.
- `variant_axes` — per-family axis metadata: `family_id`, `axis_key`, `label`, `sort_order` (drives the option pickers).

GRANT SELECT to anon+authenticated (public catalog); writes via service role only. RLS on.

Data load: parse `/mnt/user-uploads/SKU_Latest-3.xlsx` in a one-shot migration/insert — group rows by `Main SKU`, derive axes from the "Variations N / Value" pairs, keep SKUs verbatim. Existing `products` rows stay so nothing else breaks.

## 2. Queries + hook

- `familyQuery(slug)` → family + `variants[]` + `axes[]`.
- `familyListQuery(filter)` → card data (min/max price, cover image, badges).
- `useVariantSelection(family)` client hook — holds selected axis values, resolves the matching variant, exposes price/stock/sku/image without a page reload.

## 3. PDP variation switching (existing route `src/routes/products.$slug.tsx`)

Route resolves `slug` against `product_families` first, falls back to legacy `products` so old links keep working. When a family is loaded:

- Render axis pickers (chips for colour/watt, dropdown for pack size, etc.) above the qty/CTA block — same tokens, borders and typography already used on the PDP.
- Selecting a chip updates SKU line, price, MRP strike-through, stock badge, image, and specs live (no refresh).
- Cart/Buy-Now/Wishlist actions use the resolved variant id.
- Spec table extended with weight, packed dims, MOQ, retailer/distributor pricing (shown only if user role warrants it — hidden for guests).

## 4. Listing + search + filters

- `products` listing and category pages switch to family cards ("from ₹X" when variants differ). Card click → family PDP.
- Filter panel gains: Brand, Series (parent product name prefix), Wattage, Colour, Pack Size, Availability, Price range, "Has offer". Filters query variant attributes via jsonb.
- Search: extend existing search to match family name, main SKU, any variant SKU, and axis values; keep the current input + results UI.

## 5. Related / bought-together / recently viewed

- Related = same category, other families (already partially there — swap to families).
- "Recently viewed" — `localStorage` list of family slugs, rendered in the existing tile grid on PDP + home.
- "Frequently bought together" — same-category top 2 families, additive UI block on PDP.

## 6. SEO polish (existing head() blocks only)

- Family PDP `head()` fills real title/description/og:title/og:description from family data; `og:image` uses the resolved variant image.
- Add JSON-LD `Product` + `Offer` (per selected variant, price range for family) inline in the PDP.
- `robots.txt` + `sitemap.xml` regenerated from families.

## 7. Not in this pass (called out so nothing is silently dropped)

These are large modules on top of the current storefront — I'll do them as follow-up plans once the SKU model is live and you confirm scope:

- Admin dashboard (bulk upload/edit, downloads uploads, offers, SEO fields, inventory).
- Downloads library per product (datasheet/manual/warranty PDFs) — needs storage bucket + admin upload UI.
- Reviews & Q&A, Notify-when-available, Request Quote / Bulk Enquiry forms + email.
- Brand pages, Blogs/Resources CMS, Video library.
- Compare tray, Save-for-later, product share sheet.
- Part 2 items (retailer/distributor portal, Shiprocket, RBAC, analytics) — separate plan.

## Technical notes

- Migration is additive; legacy `products` rows remain readable so cart/order history doesn't break. New orders reference `variant_id`; old ones keep `product_id`.
- Parsing runs server-side from the workbook I already have at `/mnt/user-uploads/SKU_Latest-3.xlsx`; SKUs preserved exactly.
- All new UI reuses existing components (`Button`, `Tabs`, `ProductImage`, chips) so the visual language is unchanged.

Approve and I'll ship steps 1–6 in one go, then queue the follow-up plan for the admin/CMS/portal work.
