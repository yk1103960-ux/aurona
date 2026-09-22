# Aurona: Separate pricing per account type + structured Partner Programs

Everything below extends what already exists. No rebuild, no resets, no design changes elsewhere.

## What already works (confirmed by inspection)

- Each product variation already stores its own customer price, retailer price and distributor price, plus one shared stock figure.
- The site already decides which price to show from the signed-in account type, and only for approved retailers/distributors. This check happens on the server, so prices can't be faked from the browser.
- Cart, checkout and order creation already re-read the correct price on the server.
- Partner applications, approval statuses, referral codes, click/commission tracking and payouts already exist for affiliates, and programs with their own commission rules already exist.

So the real gaps are: (1) the admin screen shows one mixed price table instead of three clear ones, no separate MRP per account type, and bulk editing only touches customer prices; (2) partners are treated as one generic affiliate type instead of Sales / Loyalty / Affiliate programs.

## Part 1 — Price & Stock

1. **Three tabs inside Price & Stock: Customer | Retailer | Distributor.** Same product, same variation list, no duplicated variation setup. Each tab shows the existing variations (Watt, Colour, Size, Lens, Glass, COB, Model — whatever that product actually uses) with the columns that belong to that account type: MRP, selling price, and the shared stock.
2. **Independent values.** Typing a customer price never writes a retailer or distributor price, and vice versa. Empty retailer/distributor price keeps today's behaviour (that account type sees the customer price) and the tab states this plainly, so nothing changes for the 456 existing products until an admin fills a value in.
3. **Separate MRP per account type.** Retailer MRP and distributor MRP are added as new optional fields; when blank, the existing MRP is used. Existing MRP values are untouched.
4. **Stock stays single.** One stock pool per variation, shared by all three account types. Inventory deduction, order placement and stock updates keep working exactly as now.
5. **Bulk editing.** The existing bulk price tools gain an account-type selector (customer / retailer / distributor) and support: set a fixed price, increase/decrease by amount, increase/decrease by percentage — applied to the selected variations only.
6. **Storefront / cart / checkout.** Already correct; I will verify end to end that an approved retailer and an approved distributor each see and are charged only their own price, a pending or rejected applicant sees customer pricing, and the same price flows through cart, checkout, order, admin order view and invoice.

## Part 2 — Partner Programs

1. **Partner Programs replace the single generic affiliate type**, with three programs to start: Sales Partner, Loyalty Partner, Affiliate Partner. Adding more later is a data entry, not a rebuild.
2. **Apply as Partner**: the applicant first picks the program, then fills a short form. Name, phone, email, business, city/state, website/social, reason for applying — prefilled from their account wherever we already have it.
3. **Statuses**: pending, approved, rejected, suspended/blocked, reusing the existing approval flow.
4. **Commission per program**: percentage or fixed amount, configured separately per program (e.g. Affiliate 5%, Sales 8%, Loyalty its own reward), reusing the existing commission calculation, referral codes, tracking and payout logic.
5. **Referral tracking unchanged**: existing codes, links (`aurona.co.in/?ref=CODE`), clicks, orders and commission rows stay exactly as they are. Existing partners are not reset or deleted; each existing affiliate is simply labelled as an Affiliate Partner.
6. **Partner dashboard**: program, referral code, referral link, clicks, orders, and commission earned / pending / approved / paid. Only real recorded figures, no placeholders.
7. **Admin partner management**: review applications with applicant, program, date, contact, status, commission setup, referral details and performance; approve, reject, suspend, reactivate, set commission, change program, view referral orders and commission records — with the existing audit trail.

## Technical notes

- Migration 1 (additive only): `product_variants.retailer_mrp`, `product_variants.distributor_mrp` (nullable, no backfill that changes behaviour); extend `get_visible_prices()` to return the segment MRP with fallback to `mrp`; extend `public_product_variants` by appending columns; extend `admin_save_variant_matrix_v3` to persist the two new fields without touching customer values.
- Migration 2 (additive only): `affiliates.partner_program text` (default `affiliate`) plus an optional `loyalty` value in the `partner_type` enum; seed the three programs into `referral_programs` if absent. No column drops, renames or data resets.
- Admin UI: `VariantEditor.tsx` gains segment tabs around the existing price/stock table (one variation engine, no second variation editor). Bulk tools in the products master/bulk routes gain the segment + adjustment controls.
- Partner side: extend `partner-access.functions.ts`, `affiliate.functions.ts`, `partner.$type.tsx`, `affiliate.tsx` and the admin applications/affiliates consoles; `variant_program_commissions` already supports per-program, per-variation commission.
- Checkout keeps recomputing prices server-side via `get_visible_prices`; no client-supplied price is ever trusted.
- After each step: typecheck, production build, and a signed-in walkthrough of product page → cart → checkout for customer, retailer and distributor.

## Order of work

1. Segment MRP migration + three-tab Price & Stock UI.
2. Bulk price editing per account type.
3. Verify role pricing through cart/checkout/order/invoice.
4. Partner Programs: apply flow, statuses, commission config.
5. Partner dashboard + admin partner management.
