# Ecommain exact page port checklist

Source of truth: recovered customized Active eCommerce (`ecommain2.zip`) and `u524468065_ecom` schema. The storefront remains untouched. Original Laravel/Hostinger data is read-only; current Supabase is the writable backend.

## Completion rule
A section is not complete merely because a menu item or placeholder route exists. Each recovered page must have its real table/form/filter/action workflow mapped to the current backend and match the recovered Active eCommerce layout as closely as possible.

## Top-level sections
- [ ] Dashboard
- [ ] Products
  - [ ] All Products
  - [ ] Product Master
  - [ ] Add New Product
  - [ ] Categories
  - [ ] Bulk Import / Export
  - [ ] Bulk Photo Upload
  - [ ] Product Reviews
- [ ] Notes
- [ ] Wholesale Products
  - [ ] Customer
  - [ ] Retailer
  - [ ] Distributor
  - [ ] SKU inventory
  - [ ] Applications
- [ ] Sales
  - [ ] Orders
  - [ ] Payments
  - [ ] Carts
- [ ] Refunds
- [ ] Customers
- [ ] Uploaded Files
- [ ] Reports
- [ ] Blog System
- [ ] Marketing
- [ ] Support
- [ ] Affiliate System
- [ ] Payment Gateways
- [ ] Website Setup
- [ ] Setup & Configurations
- [ ] System
- [ ] Addon Manager

## Aurona-specific recovered requirements
- Customer / Retailer / Distributor pricing and stock are independent while SKU/variation identity is shared.
- MOQ is editable per buyer type.
- Single-PC MRP/weight/dimensions remain shared; packaging values can remain segment-specific where the current schema supports them.
- Product archive/restore/permanent-delete flows remain available.
- Bulk product create/update, export, photo upload/delete/filter, commission, FBT and affiliate workflows must remain functional.
- No destructive database reset or storefront replacement.
