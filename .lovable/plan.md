# Phase 3 — Admin Panel Deferred Modules

Building all six inside the existing `/aurona-console-9f2x7k` shell. Confidential-by-design: no credentials shown in UI, all writes go through server functions verifying `admin` role, secrets stored in Lovable Cloud secrets (never in DB).

## 1. Coupons & Offers
- New tables: `coupons` (code, type flat/pct, value, min_order, max_discount, starts_at, expires_at, usage_limit, per_user_limit, eligible_roles[], active) and `coupon_redemptions` (coupon_id, user_id, order_id, amount).
- Admin CRUD page `/aurona-console-9f2x7k/coupons`.
- Server fn `validateCoupon({ code, subtotal, role, userId })` used at checkout — returns discount or reason.
- Checkout gains coupon input; on order placement, `redeemCoupon` writes redemption row + increments usage.

## 2. Content / Banners CMS
- New table: `cms_blocks` (key unique, type: hero_slide|promo_strip|sales_of_day|homepage_section, payload jsonb, sort_order, active, starts_at, ends_at).
- Admin page `/aurona-console-9f2x7k/cms` — reorderable list, live JSON payload editor with typed forms per block type, media picker from existing `media_assets`.
- Refactor `HeroSlider`, `SalesOfTheDay`, promo strips to read from `cms_blocks` (fallback to current hard-coded content if empty).

## 3. Payment Gateway Settings (Razorpay BYOK, confidential)
- New table: `payment_gateways` (provider unique, enabled, mode test|live, config_public jsonb — non-secret only like key_id, updated_at, updated_by). Never store secrets in DB.
- Server fn `savePaymentGatewaySecret({ provider, keyId, keySecret, webhookSecret, mode })` — admin-only, writes `keyId` to `payment_gateways.config_public`, stores `RAZORPAY_KEY_SECRET` + `RAZORPAY_WEBHOOK_SECRET` via Lovable Cloud secrets (using set_secret internally). Client only sees masked "•••• last4" after save.
- Admin page `/aurona-console-9f2x7k/payments` — Connect button opens modal, fields cleared on submit, values never re-displayed.
- Checkout: server fn `createRazorpayOrder({ orderId })` → returns Razorpay order_id + public key_id. Client uses Razorpay checkout.js. Webhook route `/api/public/razorpay-webhook` verifies HMAC, marks order paid.

## 4. Shiprocket Integration (BYOK, confidential)
- Reuse `payment_gateways` pattern → new `shipping_providers` table with same shape.
- Admin page `/aurona-console-9f2x7k/shipping` — Connect modal captures email + password (or API token), stored as `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` secrets. UI shows "Connected · last verified …" only.
- Server fns: `shiprocketAuth` (cached token in `site_settings` with expiry), `pushOrderToShiprocket({ orderId })`, `getTracking({ awb })`, `syncShiprocketStatuses` (cron-friendly).
- Orders admin gains "Push to Shiprocket" button + AWB/tracking column.
- Customer order tracking page reads AWB/status.

## 5. Audit Logs
- New table: `audit_logs` (actor_user_id, actor_email, action text, entity_type, entity_id, before jsonb, after jsonb, ip, user_agent, created_at). Append-only (RLS: admins select; only service_role insert).
- Helper `logAudit()` called from every admin write server fn (products, categories, orders, coupons, cms, payments, shipping, roles).
- Admin page `/aurona-console-9f2x7k/audit` — filter by actor/action/entity/date range, JSON diff viewer.

## 6. Two-Factor Authentication (TOTP)
- New table: `user_mfa` (user_id pk, secret_ciphertext, verified_at, backup_codes_ciphertext[], last_used_at). AES-256-GCM using `MFA_ENCRYPTION_KEY` (generated secret).
- Server fns: `mfaBegin` (generate secret + QR otpauth URL), `mfaConfirm({ token })` (verify + mark verified + issue backup codes once), `mfaVerify({ token })` (login step), `mfaDisable`.
- Admin-only enforcement: after password login, if user has admin role and no verified MFA, force enrolment before granting `/aurona-console-9f2x7k` access. If verified, require TOTP on every fresh session.
- Account page for admins to view/regenerate backup codes.

## Architecture / order

Migration 1 — coupons, coupon_redemptions, cms_blocks, payment_gateways, shipping_providers, audit_logs, user_mfa (+ RLS + grants).
Migration 2 — helper SQL fns: `log_admin_action`, `redeem_coupon`, MFA-required flag on profile view.
Code pass A — Coupons + CMS + Audit Logs (no external creds).
Code pass B — Payments (Razorpay) + Shiprocket admin UIs, secret-write server fns, webhook + checkout wiring.
Code pass C — 2FA enrolment + enforcement, backup codes.

Generated secrets I'll auto-create up front: `MFA_ENCRYPTION_KEY` (64 chars). Razorpay/Shiprocket secrets are captured only when you press Connect in the admin UI — nothing to paste in chat.

## Notes / assumptions

- Existing checkout UI stays; Razorpay is added as a second payment method alongside COD. Admin can toggle either.
- Cron for Shiprocket status sync: exposed as `/api/public/cron/sync-shipments` with HMAC-guarded token; wire actual schedule later.
- All admin server fns wrapped with an `assertAdmin(context)` helper that also writes an audit row on success.
- Audit logs are immutable (no UPDATE/DELETE policy).
- If Cloud restricts programmatic secret writes from server fns, I'll fall back to storing secrets AES-encrypted in `payment_gateways.config_secret_ciphertext` using `MFA_ENCRYPTION_KEY` — still invisible to any DB reader.

Proceeding when you approve.