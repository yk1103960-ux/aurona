# Ecommain exact admin restoration

Source of truth: recovered `ecommain2.zip` Laravel/Active eCommerce application and `u524468065_ecom` database export.

## Non-negotiable target
Port the recovered administration experience page-by-page into the current Aurona React/Vite/Supabase application while preserving the current storefront and existing data. This is not a redesign and not a menu-only recreation.

## Original top-level administration
- Dashboard
- Products
- Notes
- Wholesale Products
- Sales
- Refunds
- Customers
- Uploaded Files
- Reports
- Blog System
- Marketing
- Support
- Affiliate System
- Payment Gateways
- Website Setup
- Setup & Configurations
- System
- Addon Manager

## Recovery rules
- Original Hostinger/Laravel installation remains read-only.
- No destructive Supabase migrations or data wipes.
- Existing working Remix/Aurona features are preserved while original Ecommain screens and workflows are mapped.
- Customer, Retailer and Distributor remain first-class buyer types.
- Shared product identity/SKU and shared single-piece physical properties are preserved where required by the current Aurona specification.
- No section is marked complete until its actual recovered screens, subpages, forms, filters, actions and permissions have been implemented and verified.

## Status
Exact-port branch initialized. Existing `EcommainAdminShell` is only a temporary navigation bridge and is not considered a completed restoration.
