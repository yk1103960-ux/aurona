# Implementation Plan - Aurona E-Commerce Master Fix & Upgrade

This plan covers Phase 2-18 of the Aurona E-Commerce upgrade, focusing on Mega Menu fixes, product routing, account/auth logic, and CMS frontends.

## User Review Required

> [!IMPORTANT]
> The PhonePe payment integration is intentionally excluded from this phase as requested.

- **Partner Workflow:** Retailer/Distributor accounts require manual verification by admin before they can see partner-specific pricing or place bulk orders.
- **OTP Provider:** SMS OTP is configured for MSG91. Ensure the `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` are set in the environment.

## Proposed Changes

### Phase 2: Mega Menu & Product Routing
- Overhaul `src/components/layout/Header.tsx` to use real database-backed slugs.
- Map "Decorative Lights", "Interior Lights", "Outdoor Lights", "Home Appliances", "Fans", etc., to their respective families.
- Fix broken links in the mega menu (e.g., "Bluetooth High Bass", "Rope Way" which don't exist as products yet).

### Phase 3: Product Visibility & Zero-Price Handling
- Update `src/lib/queries.ts` to include products with `min_price = 0` (e.g., Gorden, High Glow).
- Update `src/components/product/ProductCard.tsx` and `src/routes/products.$slug.tsx` to display "Price on Request" instead of 0.00.
- Ensure "Add to Cart" is replaced with "Contact Us" or "Inquiry" for zero-priced items.

### Phase 4-6: Account & Auth Hardening
- Implement India-only 10-digit mobile number validation in `src/routes/auth.tsx`.
- Update profile schema to include `district` and `is_verified` status.
- Finalize OTP verification flow (mandatory for Retailer/Distributor).

### Phase 7-10: CMS Frontends
- Build dynamic frontend pages for:
  - `/customer-service` (FAQs from `public.faqs`)
  - `/careers` (Jobs and Referrals from `public.career_programs`)
  - `/blogs` (Posts from `public.blog_posts`)
- Implement social link management from `site_settings`.

### Phase 11-13: UI Refinements
- Fix blurry logo issue in `Header.tsx` by using higher resolution source and proper CSS scaling.
- Clean up redundant popups and refine "Picture box" layout on PDP.

### Phase 14-18: Advanced Features & Admin
- Implement "Compare Items" feature (max 3 products).
- Set up notification logging for account changes.
- Harden the `/aurona-console-9f2x7k` admin panel with better RBAC checks.

## Technical Details

- **Database:** Using `public.product_families` as the primary source for product listings to handle variations correctly.
- **Auth:** Supabase Auth with custom `user_roles` table for RBAC.
- **Styling:** Tailwind CSS v4 with custom glassmorphism utilities.
- **State Management:** TanStack Query for data fetching and caching.

## Verification Plan

- **Responsive Audit:** Run Playwright tests at 320px, 375px, and 1280px to ensure zero horizontal scrolling.
- **Auth Flow:** Verify login/register with valid and invalid Indian phone numbers.
- **Mega Menu:** Click every link in the mega menu to ensure they lead to existing category/product pages.
- **Partner Pricing:** Log in as an approved Retailer to verify price changes compared to Guest view.
