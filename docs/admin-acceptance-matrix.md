# Aurona detailed admin acceptance matrix

Audit date: 2026-09-06. Old production was inspected read-only. No old or new production records were changed. Aurona code was inspected on `codex/phase-2a-admin`. The forward migration in this pass was created but not applied.

## Status legend

- **VERIFIED WORKING** — observed in the live old admin or covered by an existing Aurona runtime flow from the prior phase.
- **IMPLEMENTED BUT UNVERIFIED** — implementation and static checks exist; staging database/runtime verification is still required.
- **PARTIAL** — a useful implementation exists but does not cover the whole old workflow.
- **BROKEN** — the inspected old page failed or an Aurona path is known to fail.
- **NOT APPLICABLE** — legacy marketplace/platform maintenance behavior is outside Aurona's business model.
- **INTENTIONALLY REPLACED** — Aurona provides the capability through a safer or more coherent workflow.

## A. Complete old-admin hierarchy

- Dashboard
- Products
  - Add New Product
  - All Products
  - In House Products
  - Digital Products
  - Bulk Import
  - Bulk Export
  - Category
  - Category Based Discount
  - Brand
  - Attribute
  - Colors
  - Size Guide
  - Warranty
  - Product Reviews
- Notes
  - Add New Note
  - Note List
- Wholesale Products
  - Add New Wholesale Product
  - All Wholesale Products
  - In House Wholesale Products
- Sales
  - All Orders
  - Inhouse Orders
  - Pickup Point Orders
  - Unpaid Orders
- Refunds
  - Refund Requests
  - Approved Refunds
  - Rejected Refunds
  - Refund Configuration
- Customers
  - Customer List
  - Retailer List
  - Distributor List
- Uploaded Files
- Reports
  - Earning Report
  - In House Product Sale
  - Seller Products Sale
  - Products Stock
  - Products Wishlist
  - User Searches
  - Commission History
  - Wallet Recharge History
- Blog System
  - All Posts
  - Categories
- Marketing
  - Flash Deals
  - Dynamic Pop-up
  - Custom Alert
  - Email Templates
  - Newsletters
  - Notification
  - Bulk SMS
  - Subscribers
  - Coupon
- Support
  - Ticket
  - Product Conversations
  - Product Queries
  - Contacts
- Affiliate System
  - Affiliate Registration Form
  - Affiliate Configurations
  - Affiliate Users
  - Referral Users
  - Affiliate Withdraw Requests
  - Affiliate Logs
- OTP System
  - OTP Login Configuration
  - OTP Configurations
  - SMS Templates
- Payment Gateways
  - Payment Methods
- Website Setup
  - Select Homepage
  - Homepage Settings
  - Authentication Layout & Settings
  - Header
  - Footer
  - Pages
  - Appearance
- Setup & Configurations
  - Features Activation
  - Languages
  - Currency
  - VAT & TAX
  - Pickup Point
  - SMTP Settings
  - Order Configuration
  - File System & Cache Configuration
  - Social Media Logins
  - Facebook
  - Google
  - Shipping
- System
  - Update
  - Server Status
- Addon Manager

## B. Complete Aurona hierarchy after this pass

- Dashboard
- Products
  - All Products
  - Add New Product
  - Bulk Import & Export
  - SKU Inventory
  - Categories
  - Brands & Attributes
  - Variation Images
  - Product Reviews
- Sales
  - Orders
  - Returns & Refunds
  - Abandoned Carts
  - Payments
- Customers & Partners
  - Customers
  - Partner Applications
  - Affiliates
  - Career Applications
- Marketing
  - Coupons
  - Campaigns
  - Homepage & Alerts
  - Blogs, Careers & FAQs
- Operations
  - Support Inbox
  - Shipping
  - Shipping & Tax Rules
  - Reports
  - Audit Logs
- Configuration
  - Integrations
  - Security & 2FA
  - Roles & Permissions
  - Settings

## C. Products — detailed matrix

| Page / control                       | Old admin                                  | Aurona before                                     | Aurona after                                                                          | Verification                                     | Files                                              |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Product menu dropdown                | Yes                                        | No; flat sidebar                                  | Implemented grouped/collapsible product hierarchy                                     | Static verified; runtime required                | `AdminShell.tsx`                                   |
| List search by name/SKU              | Yes                                        | Yes, legacy products                              | Family name/main SKU/slug search                                                      | Static verified; runtime required                | products index, catalog admin functions            |
| Category filter                      | No on inspected all-products list          | No                                                | Implemented                                                                           | Static verified; runtime required                | products index                                     |
| Brand filter                         | No on inspected list                       | No                                                | Implemented from family data                                                          | Static verified; runtime required                | products index                                     |
| Stock filter                         | No on inspected list                       | No                                                | In/low/out/all implemented                                                            | Static verified; runtime required                | products index                                     |
| Published filter                     | Sort dropdown only                         | No                                                | Published/hidden/archived implemented                                                 | Static verified; runtime required                | products index                                     |
| Sort rating/sales/base price         | Yes                                        | No                                                | Name, price, stock, rating, updated implemented; sales sort remains report-only       | PARTIAL; runtime required                        | products index                                     |
| Pagination                           | Yes                                        | Yes                                               | Preserved on family query                                                             | Static verified; runtime required                | products index                                     |
| Bulk select                          | Yes                                        | Yes                                               | Preserved                                                                             | Static verified; runtime required                | products index                                     |
| Bulk publish/unpublish               | Yes                                        | Unsafe direct legacy update                       | Transactional family-authoritative server RPC                                         | Static verified; runtime required                | products index, catalog admin functions, migration |
| Bulk feature/deal                    | Bulk menu present                          | No                                                | Implemented                                                                           | Static verified; runtime required                | products index, migration                          |
| Bulk archive/restore                 | Delete in old                              | Hard delete in Aurona                             | Archive/restore preserves orders and SKUs                                             | IMPLEMENTED BUT UNVERIFIED                       | products index, migration                          |
| Permanent product delete             | Yes                                        | Yes                                               | Intentionally removed from routine UI                                                 | INTENTIONALLY REPLACED by archive                | products index                                     |
| Duplicate                            | Yes                                        | Legacy row only                                   | Transactional family + variants + axes + image assignments; new stock zero and hidden | IMPLEMENTED BUT UNVERIFIED                       | products index, migration                          |
| Edit                                 | Yes                                        | Yes                                               | Family-authoritative load/save                                                        | IMPLEMENTED BUT UNVERIFIED                       | product editor, catalog admin functions            |
| View storefront                      | Yes                                        | No                                                | Implemented in new tab                                                                | Static verified; runtime required                | products index                                     |
| Featured / Today's Deal              | Yes                                        | Existing editor flags                             | List bulk actions plus editor flags                                                   | IMPLEMENTED BUT UNVERIFIED                       | products index/editor, migration                   |
| Add product atomicity                | Save publish/unpublish                     | Family transaction existed                        | Extended v2 transaction keeps compatibility projection synchronized                   | IMPLEMENTED BUT UNVERIFIED                       | catalog admin functions, migration                 |
| Name, SKU, brand, category, unit     | Yes                                        | Yes                                               | Existing and preserved                                                                | Static verified; runtime required                | product editor                                     |
| Weight and dimensions                | Yes                                        | Yes                                               | Family and per-SKU/package dimensions                                                 | INTENTIONALLY REPLACED by richer SKU dimensions  | product editor, VariantEditor                      |
| Minimum purchase / MOQ               | Yes                                        | Per-SKU MOQ                                       | Preserved per customer/retailer/distributor SKU                                       | INTENTIONALLY REPLACED                           | VariantEditor                                      |
| Tags                                 | Yes                                        | No                                                | Not implemented; no storefront/search consumer                                        | NOT APPLICABLE pending merchandising requirement | —                                                  |
| Hierarchical category selection      | Yes                                        | Flat select; hierarchy managed on categories page | PARTIAL                                                                               | Runtime required                                 | product editor, categories route                   |
| Rich-text description                | Yes                                        | Plain structured text                             | Plain description + structured features/specification                                 | PARTIAL; intentional XSS-safe choice             | product editor                                     |
| Refundable + refund note             | Yes                                        | No                                                | Implemented                                                                           | IMPLEMENTED BUT UNVERIFIED                       | product editor, migration                          |
| Published, featured, new, sale, deal | Yes                                        | Yes                                               | Preserved and list actions added                                                      | Static verified; runtime required                | product editor/index                               |
| Flash deal assignment                | Yes                                        | Campaign model                                    | Campaigns schedule independently and product deal flag remains                        | INTENTIONALLY REPLACED                           | campaigns route                                    |
| Per-product VAT/GST                  | Yes                                        | Rule engine                                       | Category/product tax rules centralized                                                | INTENTIONALLY REPLACED                           | shipping-rules route                               |
| Gallery/thumbnail                    | Yes                                        | Family images                                     | Family gallery with explicit primary                                                  | Existing; runtime recheck required               | ProductImageManager                                |
| SKU-specific images                  | Variation photos                           | Yes                                               | Preserved as first-class variant assignments                                          | Existing; Flood Light runtime test required      | ProductImageManager, product-images library        |
| Image primary behavior               | Thumbnail                                  | Explicit family/SKU primary                       | Better scoped primary RPC                                                             | Existing; runtime recheck required               | ProductImageManager, Phase 2A migration            |
| Image ordering                       | Gallery order                              | Numeric sort                                      | Existing                                                                              | Runtime required                                 | ProductImageManager                                |
| Image delete/replace                 | Yes                                        | Yes                                               | Existing; deletion confirmation and primary reassignment                              | Runtime required                                 | ProductImageManager                                |
| Video provider and URL               | YouTube/Dailymotion/Vimeo                  | No                                                | Implemented plus Other                                                                | IMPLEMENTED BUT UNVERIFIED                       | product editor, migration                          |
| PDF specification                    | Yes                                        | No                                                | Implemented URL field                                                                 | IMPLEMENTED BUT UNVERIFIED                       | product editor, migration                          |
| Variant axes/options                 | Colour + many choice attributes            | First-class axes                                  | Preserved                                                                             | Existing; runtime recheck required               | AxisEditor, VariantEditor                          |
| SKU code                             | Yes                                        | Yes                                               | First-class unique SKU                                                                | Existing                                         | VariantEditor                                      |
| Barcode/GTIN                         | Applicable checklist item                  | No                                                | Optional unique barcode implemented                                                   | IMPLEMENTED BUT UNVERIFIED                       | VariantEditor, migration                           |
| Active/inactive SKU                  | Stock visibility                           | Yes                                               | Archive-like inactive SKU behavior                                                    | Existing; runtime recheck required               | VariantEditor                                      |
| Variant sort                         | Generated table                            | Yes                                               | Existing sort order                                                                   | Runtime required                                 | VariantEditor                                      |
| Consumer MRP/price/discount          | Yes                                        | Yes                                               | Per SKU with calculated savings                                                       | Existing                                         | VariantEditor                                      |
| Retailer price/MOQ                   | Yes                                        | Yes                                               | Per SKU                                                                               | Existing                                         | VariantEditor                                      |
| Distributor price/MOQ                | Yes                                        | Yes                                               | Per SKU                                                                               | Existing                                         | VariantEditor                                      |
| Separate retailer/distributor stock  | Yes                                        | Shared physical SKU stock                         | Shared physical inventory prevents double counting                                    | INTENTIONALLY REPLACED                           |
| External purchase link/button        | Yes                                        | No                                                | Not implemented because Aurona checkout is authoritative                              | NOT APPLICABLE                                   |
| Low-stock threshold/visibility       | Yes                                        | Per SKU threshold                                 | Dedicated inventory filter and threshold                                              | Better Aurona workflow                           | VariantEditor, inventory route                     |
| SEO slug                             | Yes                                        | Yes                                               | Preserved                                                                             | Static verified; runtime required                | product editor                                     |
| Meta title/description/image         | Yes                                        | Placeholder only                                  | Implemented fields and preview                                                        | IMPLEMENTED BUT UNVERIFIED                       | product editor, migration                          |
| Free/flat/calculated shipping        | Yes                                        | Calculated only                                   | Implemented product override fields                                                   | IMPLEMENTED BUT UNVERIFIED                       | product editor, migration                          |
| Multiply shipping by quantity        | Yes                                        | No                                                | Implemented                                                                           | IMPLEMENTED BUT UNVERIFIED                       | product editor, migration                          |
| Estimated delivery days              | Yes                                        | No                                                | Implemented                                                                           | IMPLEMENTED BUT UNVERIFIED                       | product editor, migration                          |
| Warranty                             | Yes                                        | Free text                                         | Preserved plus reusable warranty catalog                                              | IMPLEMENTED BUT UNVERIFIED                       | product editor/options, migration                  |
| Frequently bought products           | Yes                                        | Placeholder                                       | Real ordered family relationship selector                                             | IMPLEMENTED BUT UNVERIFIED                       | product editor, catalog admin functions, migration |
| Save publish/unpublish buttons       | Yes                                        | Single Save + published toggle                    | Single atomic save honors published state                                             | INTENTIONALLY REPLACED                           |
| Digital products                     | Yes                                        | No                                                | Physical electrical-products store only                                               | NOT APPLICABLE                                   |
| In-house vs seller products          | Yes                                        | No marketplace sellers                            | Unified Aurona-owned catalog                                                          | NOT APPLICABLE                                   |
| Wholesale product duplicates         | Separate old module                        | Role prices in same SKU family                    | Better unified family/variant workflow                                                | INTENTIONALLY REPLACED                           |
| Bulk CSV import                      | Yes                                        | Yes                                               | Existing preview/validation/import                                                    | Runtime required                                 | products bulk route                                |
| Bulk CSV export                      | Yes; download blocked during browser audit | Yes                                               | Existing family/SKU export                                                            | Runtime required                                 | products bulk route                                |
| Bulk rollback                        | No                                         | Yes                                               | Existing import-run rollback                                                          | Better Aurona workflow                           | products bulk route                                |
| Category CRUD/hierarchy              | Yes                                        | Yes                                               | Existing                                                                              | Runtime recheck required                         | categories route                                   |
| Category discount                    | Yes                                        | Coupon/campaign/rule model                        | No direct blanket category price mutation                                             | INTENTIONALLY REPLACED                           |
| Brands                               | Yes                                        | Free text only                                    | Reusable archive-safe option screen                                                   | IMPLEMENTED BUT UNVERIFIED                       | products options, migration                        |
| Attributes                           | Yes                                        | Per-family axes only                              | Reusable definitions + per-family axes                                                | IMPLEMENTED BUT UNVERIFIED                       | products options, AxisEditor                       |
| Colours                              | Yes                                        | Axis values only                                  | Reusable name/hex options + axes                                                      | IMPLEMENTED BUT UNVERIFIED                       | products options, migration                        |
| Size guide                           | Yes                                        | No                                                | Reusable guide records                                                                | IMPLEMENTED BUT UNVERIFIED                       | products options, migration                        |
| Product reviews                      | Yes                                        | Yes                                               | Moderation and rating recalculation                                                   | Existing; runtime required                       | reviews route, operations admin functions          |

### Flood Light acceptance scenario

Static path verified: create family → initial SKU → add 30W/50W/100W rows → independent public/MRP/retailer/distributor price, MOQ, stock, barcode, dimensions → save transactional matrix → attach images by variant SKU → select SKU on storefront and resolve SKU image. No production record was created. End-to-end runtime verification remains required after applying the new migration to staging.

## D. Inventory, sales and customer matrix

| Capability                             | Old admin                       | Aurona before/after                                            | Verification                                | Files                                       |
| -------------------------------------- | ------------------------------- | -------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Product stock report                   | Yes                             | Dedicated SKU inventory replaces family total editing          | Existing; runtime required                  | inventory route                             |
| SKU search / low stock / out of stock  | Basic report                    | Search, low-only and available calculation                     | Existing; runtime required                  | inventory route, catalog admin functions    |
| Increase/decrease with reason          | No dedicated ledger UI observed | Server adjustment with required reason                         | Better Aurona workflow; runtime required    | inventory route, catalog admin functions    |
| Inventory history/ledger               | No                              | Immutable ledger                                               | Better Aurona workflow; runtime required    | inventory route, Phase 2A migration         |
| Reservations                           | No                              | Reserved stock tracked                                         | Better Aurona workflow; runtime required    | inventory route, migrations                 |
| Order decrement/cancel restock         | Coarse product stock            | Transactional SKU movements and cancellation reversal          | Existing; runtime required                  | checkout/order RPC migrations               |
| Bulk stock CSV                         | Stock report only               | Not included in this pass                                      | PARTIAL; future operational enhancement     |
| Order list: search/status/payment/date | Yes                             | Existing filters                                               | Runtime required                            | orders route                                |
| Order list customer filter/pagination  | Customer shown; pagination      | Existing search/pagination; customer via search                | Runtime required                            | orders route                                |
| Order details/items/SKU snapshots      | Yes                             | Immutable product/SKU/attribute snapshots                      | Better Aurona workflow                      | order detail route, migrations              |
| Addresses/totals/coupon/tax/shipping   | Yes                             | Existing detail breakdown                                      | Runtime required                            | order detail route                          |
| Timeline/admin notes                   | Status controls                 | Existing status events and notes                               | Better Aurona workflow                      | order detail route                          |
| Tracking/AWB/Shiprocket                | Shipping action                 | Existing provider workflow                                     | Runtime required; do not call live provider | order detail/shipping routes                |
| Invoice/print                          | Options in old                  | Existing browser printable detail; dedicated PDF not confirmed | PARTIAL                                     |
| Cancellation/restock/coupon reversal   | Yes                             | Atomic guarded transition                                      | Better Aurona workflow; runtime required    | order admin functions, order migration      |
| Customer search/details/order history  | Yes                             | Existing unified customer screen                               | Runtime required                            | customers route, user admin functions       |
| Block/unblock/archive/restore          | Status/bulk actions             | Existing server-enforced status controls                       | Runtime required                            | customers route, user admin functions       |
| Retailer/distributor queues            | Separate lists                  | Unified partner applications with filters                      | INTENTIONALLY REPLACED                      | applications route                          |
| Approve/reject with reason             | Status filters                  | Existing audited server actions                                | Runtime required                            | applications route, partner admin functions |
| Wholesale access control               | Old separate products           | Approved role pricing and server pricing-role checks           | Better Aurona workflow; runtime required    | partner access/pricing functions            |

## E. Coupons, returns, reports, marketing and content

| Old submenu/capability                  | Old admin                         | Aurona result                                                             | Verification                                          | Files                                 |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| Coupon list/create/edit                 | Yes                               | Existing complete fields and validation                                   | Runtime required                                      | coupons route, coupon admin functions |
| Coupon flat/% value, min, max           | Yes                               | Existing; discount calculated server-side and capped                      | Static verified; checkout runtime required            | coupons functions, checkout functions |
| Usage/per-user/roles/dates              | Yes                               | Existing                                                                  | Runtime required                                      | coupons route/functions               |
| Coupon archive/history                  | Delete option                     | Archive preserves redemptions                                             | Better Aurona workflow                                | coupon admin functions                |
| Coupon restore                          | Not observed                      | No restore UI                                                             | PARTIAL                                               |
| Eligible products/categories            | Old type-dependent                | Role targeting only                                                       | PARTIAL; schema expansion deferred                    |
| Redemption history/count                | Count in list                     | Count in list/report; raw history retained                                | Existing                                              |
| Coupon image                            | Old reported blank image behavior | No decorative coupon image dependency; icon/text fallback                 | INTENTIONALLY REPLACED; blank-image defect eliminated |
| Checkout discount                       | Reported unreliable old behavior  | Direct authenticated server validation; order transaction uses same rules | Static verified; runtime required                     | CouponBox, coupons/checkout functions |
| Cancellation reversal                   | Not verified                      | Atomic redemption reversal                                                | Runtime required                                      | order workflow migration              |
| Refund Requests                         | Old route BROKEN                  | Unified returns queue                                                     | Better Aurona workflow; runtime required              | returns route                         |
| Approved/Rejected refunds               | Yes                               | Status filters and guarded transitions                                    | Runtime required                                      | returns route/functions               |
| Replacement/refund/reference/events     | Limited                           | First-class kind, refund data and timeline                                | Better Aurona workflow                                | returns route, operations migration   |
| Earning report                          | Yes                               | Revenue metrics/date range/export                                         | Implemented; runtime required                         | reports route/functions               |
| In-house product sale                   | Yes                               | Top SKU sales                                                             | INTENTIONALLY REPLACED                                |
| Seller products sale                    | Old route BROKEN                  | NOT APPLICABLE; no seller marketplace                                     |
| Products stock                          | Yes                               | Low-stock SKU report + inventory page                                     | Better Aurona workflow                                |
| Products wishlist                       | Yes                               | Wishlist product counts added                                             | IMPLEMENTED BUT UNVERIFIED                            | reports route/functions               |
| User searches                           | Yes                               | No durable search analytics table                                         | MISSING; requires privacy/product decision            |
| Commission history                      | Yes                               | Affiliate logs/conversions                                                | Existing                                              | affiliates route/functions            |
| Wallet recharge history                 | Yes                               | No store wallet                                                           | NOT APPLICABLE                                        |
| Customer report                         | Not separate old submenu          | Registration and account-type panel added                                 | IMPLEMENTED BUT UNVERIFIED                            | reports route/functions               |
| Coupon report                           | Not separate old submenu          | Coupon performance panel added                                            | IMPLEMENTED BUT UNVERIFIED                            |
| Return report                           | Not separate old submenu          | Status/refund-value panel added                                           | IMPLEMENTED BUT UNVERIFIED                            |
| Payment report                          | Gateway records elsewhere         | Gateway state/provider panel added                                        | IMPLEMENTED BUT UNVERIFIED                            |
| Flash deals                             | Yes                               | Campaign scheduling + product deal flag                                   | Existing; runtime required                            | campaigns route                       |
| Dynamic pop-up/custom alert             | Yes                               | Unified content blocks/alerts                                             | INTENTIONALLY REPLACED                                | content route                         |
| Newsletter/bulk SMS/subscribers         | Yes                               | Integration/notification foundation; no unsafe bulk-send UI               | PARTIAL; deliberate live-send safety boundary         |
| Blog posts/categories                   | Yes                               | Unified editorial tabs                                                    | Existing; runtime required                            | editorial route                       |
| Pages/homepage/header/footer/appearance | Yes                               | Structured content/settings rather than theme builder                     | PARTIAL / INTENTIONALLY REPLACED                      | content/settings/editorial routes     |
| Careers/vacancies/applications          | Yes                               | Full vacancy and application handling                                     | Existing; runtime required                            | editorial/careers routes              |

## F. Support, affiliates, shipping, payments, permissions and settings

| Old submenu/capability                             | Old admin                  | Aurona result                                                                | Verification                                   | Files                                      |
| -------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| Tickets                                            | Yes                        | Support inbox, threads, replies, internal notes, status                      | Existing; runtime required                     | support route, operations functions        |
| Product conversations/queries/contacts             | Separate lists             | Unified typed support inbox                                                  | INTENTIONALLY REPLACED                         |
| Affiliate registration form                        | Configurable field builder | Fixed validated partner application                                          | INTENTIONALLY REPLACED; simpler data contract  |
| Affiliate configuration/category commission        | Yes                        | Programs + product overrides                                                 | Existing; runtime required                     | affiliates route/functions, product editor |
| Affiliate users/referrals/logs                     | Yes                        | Existing users, codes, conversions and logs                                  | Runtime required                               | affiliates route/functions                 |
| Withdraw requests/bank-UPI                         | Yes                        | Payout information exists; live disbursement not automated                   | PARTIAL; payment safety boundary               |
| OTP login/config                                   | Old pages BROKEN           | Aurona OTP and 2FA/security flows                                            | Existing; runtime required                     | security route, otp/mfa functions          |
| SMS template                                       | Yes                        | Notification templates not exposed as arbitrary SMS body                     | PARTIAL                                        |
| Payment methods                                    | Many legacy gateways       | PhonePe/COD plus integration status; secrets server-only                     | INTENTIONALLY REPLACED                         | payments/integrations routes               |
| Payment records/status/reference/order             | Old order columns          | Dedicated payment events and filters                                         | Better Aurona workflow                         | payments route/functions                   |
| Shipping zones/rates/COD                           | Nested legacy shipping     | Dedicated zones and rules                                                    | Existing; runtime required                     | shipping and shipping-rules routes         |
| Pickup points                                      | Yes                        | Not implemented; current delivery model is shipment-based                    | NOT APPLICABLE unless pickup launches          |
| VAT/TAX                                            | Yes                        | Tax rules per geography/category                                             | Better Aurona workflow                         | shipping-rules route                       |
| SMTP/social credentials/file storage               | Raw secret forms           | Integration health/config from server environment                            | INTENTIONALLY REPLACED; secrets never returned | integrations route/functions               |
| Feature activation                                 | Global toggles             | Purpose-specific settings/routes                                             | INTENTIONALLY REPLACED                         |
| Languages                                          | English old                | English/Hindi selector and persistence; placeholders/tooltips now translated | IMPLEMENTED BUT UNVERIFIED                     | i18n.tsx, Header.tsx                       |
| Currency                                           | Multi-currency settings    | INR-only business                                                            | NOT APPLICABLE                                 |
| Order configuration                                | Minimum/GST/fee            | Settings + tax/shipping engine                                               | PARTIAL / INTENTIONALLY REPLACED               |
| System update/server status/addons                 | Yes                        | Hosting/dependency deployment concern, not business admin                    | NOT APPLICABLE                                 |
| Admin/staff roles                                  | Platform roles             | Access profiles, route/action permissions, server assertions                 | Better Aurona workflow; runtime required       | roles route, access/admin server functions |
| Audit trail                                        | Limited                    | Dedicated immutable audit log                                                | Better Aurona workflow                         | audit route, admin server functions        |
| Security/2FA                                       | OTP subsystem              | Dedicated security and MFA                                                   | Better Aurona workflow                         | security route/functions                   |
| General/branding/contact/SEO/social/order settings | Spread across old menus    | Unified settings + content + integrations                                    | Existing/PARTIAL; runtime required             | settings/content/integrations routes       |

## G. UI and route integrity

All Aurona sidebar destinations map to generated TanStack routes. The new `products/options` route was generated successfully during the production build. Admin mutations added in this pass run through authenticated server functions with explicit `catalog.manage` or `reports.view` permission checks. Loading, empty, error, success, confirmation, pagination and responsive overflow states were inspected in the changed screens. Full click-through remains a staging runtime test.

## H. Intentionally excluded old-platform functions

- Marketplace seller/in-house duplication, seller reports and vendor activation: Aurona is not a third-party marketplace.
- Digital products: current catalog and fulfillment are physical electrical goods.
- Wallet recharge: Aurona has no stored-value wallet.
- Addon manager, PHP server status and in-admin system updater: hosting/deployment responsibilities, not commerce operations.
- Dozens of raw payment/storage/SMTP/social secret fields: integrations are environment-managed and secrets must never be rendered back to admins.
- Theme/homepage selector and authentication-layout skins: Aurona has a purpose-built storefront rather than interchangeable legacy themes.
- Separate retailer/distributor products and stock: unified variants with role pricing and one physical SKU inventory are safer.

## I. Better Aurona capabilities retained

- Product families are authoritative; legacy products are a compatibility projection.
- SKU variants, price tiers, MOQ, barcode, package dimensions and stock are first-class.
- Images can be scoped to a family or SKU with independent primary behavior.
- Inventory ledger, reservations, atomic checkout decrement, cancellation restore and audit events.
- Unified partner approvals and server-side pricing authorization.
- Returns/replacements with guarded transitions and event history.
- Environment-managed integration secrets, MFA, granular permissions and audit logs.
- Import preview and rollback, archive instead of destructive deletion, and snapshot-based order history.

## J. Remaining runtime-only acceptance tests

1. Apply `20260907160000_product_admin_parity.sql` to an isolated staging Supabase project only.
2. Confirm baseline remains 456 legacy products, 70 original families, 457 original variants and zero empty original families before test fixtures.
3. Sign in as administrator and click every sidebar group and child route at desktop and mobile widths.
4. Create a staging-only Flood Light family with 30W, 50W and 100W SKUs; verify independent prices, partner prices, MOQ, stock, barcode and dimensions.
5. Upload family and SKU-specific images; set/reassign primary; reorder; replace/delete a disposable image; confirm storefront image switches per selected SKU.
6. Edit each Flood Light SKU, archive/restore the family, duplicate it, and verify the duplicate is hidden with zero stock and unique SKUs/barcodes.
7. Exercise list filters, sorting, pagination, feature/deal actions and bulk publish/unpublish/archive/restore.
8. Import a small valid CSV, reject an invalid CSV, export, then roll back the test import.
9. Adjust SKU inventory up/down with reasons; verify ledger, low-stock/out-of-stock filters and reserved availability.
10. Place a test order through a non-live payment mode; verify snapshots, SKU decrement and coupon discount once; cancel and verify stock/coupon reversal exactly once.
11. Exercise permitted order transitions, notes, tracking fields and final-state guards without calling a live carrier.
12. Approve/reject disposable partner applications and verify public/approved pricing authorization.
13. Create/edit/archive disposable coupons; verify flat and percentage totals, max discount, dates, limits and role targeting. Confirm checkout has no blank-image dependency.
14. Exercise return/replacement approval/rejection/refund-reference transitions and final-state protection.
15. Validate every report panel and CSV against seeded staging facts.
16. Moderate a disposable review and confirm rating summary recalculation.
17. Reply to a disposable support ticket, add an internal note and change status.
18. Verify role restrictions with a least-privilege staff profile at both route and server-action layers.
19. Switch English ↔ Hindi across header, cart and checkout; reload and confirm persistence and translated placeholders/tooltips.
20. Inspect browser console/network errors and keyboard/focus behavior on all changed dialogs/forms.

## K. Migration and static verification

New, forward-only, not applied:

- `supabase/migrations/20260907160000_product_admin_parity.sql`

It adds extended product metadata/shipping/refund fields, barcode, related products, reusable catalog options, and service-role-only transactional admin RPC wrappers/actions. Prior applied migrations were not changed.

Static checks for the final commit are recorded in the handoff after they are rerun. No automated test script exists in `package.json`; typecheck, production build, changed-file lint where practical, and `git diff --check` are the available gates.
