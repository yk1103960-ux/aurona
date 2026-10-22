# Aurona Active eCommerce Laravel restoration

This directory is reserved for the **real recovered Laravel 10 / Active eCommerce application** from `ecommain2.zip`.

## Goal

Restore the original customized Aurona admin and commerce backend exactly, rather than recreating it as React navigation cards.

The recovered application is expected to contain the original Laravel structure:

- `app/`
- `bootstrap/`
- `config/`
- `database/`
- `public/`
- `resources/`
- `routes/`
- `storage/`
- `artisan`
- `composer.json`
- `composer.lock`
- `package.json`
- `webpack.mix.js`
- root `index.php` and `.htaccess`

Important recovered custom modules include `routes/admin.php`, `routes/wholesale.php`, retailer/distributor routes, role-based pricing, retailer/distributor stock services, product/order/refund/affiliate/payment flows, uploads, addons, reports, roles and permissions.

## Safety rules

- Never commit `.env`, production credentials, payment secrets, private logs, or production database dumps.
- The original Hostinger installation remains read-only.
- Use a separate staging database.
- Keep PHP at 8.2 and Laravel at the recovered Laravel 10 dependency set during the first restoration.
- Do not run destructive migrations against production data.
- The current React storefront stays intact while this Laravel application becomes the restored admin/commerce source of truth.

## Import

Use `scripts/import-active-ecommerce-backup.sh /path/to/ecommain2.zip` from the repository root. The script copies the recovered Laravel application into this directory while excluding secrets, cache files, logs and obvious database/archive artifacts from Git history.

After import, review the diff before pushing. Production uploads and database data must be restored to staging separately and must not be committed to GitHub.
