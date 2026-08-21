# Aurona — Master Fix & Implementation

Audit findings first, then a phased build. Nothing gets mocked; every item is traced to its root cause.

## What the audit already shows

- **Categories exist and are populated** — Interior Lights (125), LED Bulbs (48), Outdoor Lights (6), Madhani (4), Table Fans (8).
- **"Decorative Lights" does not exist as a category.** The mega menu's "Decorative" column points at the `interior-lights` slug — that is exactly why Interior Lights products appear under Decorative. Root cause is category mapping, not the UI.
- **Outdoor Lights is not empty** (6 GORDEN products, all published) — so the "no products" report is a listing/filter/menu-link problem, not missing data.
- **High Glow, Power+/Night Bulbs, Madhani, Classic (TF-CL) all exist and are published** — the homepage/menu links are pointing at the wrong slugs.
- **Blogs and Careers pages exist but are hardcoded** (`src/lib/blog-data.ts`, a `JOBS` array) — they need real tables plus admin management.
- **Compare does not exist** anywhere.
- **Payments**: PhonePe and Razorpay server functions and webhooks already exist — they need verification hardening, not a rewrite.
- Social links already resolve from `site_settings` with defaults; they need admin editing plus hide-when-unset behaviour.

## Phase 1 — Catalog truth (items 4-9)

- Create a real **Decorative Lights** category; move the genuinely decorative SKUs (Rope Way, Strips, Bluetooth High Bass and similar) out of Interior Lights into it.
- Clean Interior Lights so it holds only interior products.
- Fix mega-menu and homepage links so every heading maps to its real category slug, and each product tile links to its own product slug (High Glow inside LED Bulbs, Power+ Night Bulb, Madhani under Home Appliances, Classic under Table Fans).
- Verify Outdoor Lights renders in category page, search, filters and PDP.
- All category remapping done through a database migration, not UI filtering.

## Phase 2 — Accounts, validation, verification (items 14-19, 22)

- India-only phone input: fixed `+91`, exactly 10 digits, digits-only, normalised to one stored format; identical rules enforced in the server function.
- Email format validation + duplicate detection, friendly messages, shared client/server schema.
- Password rules relaxed to a single reasonable rule (length-based), same rule client and server; storage unchanged.
- Fix the login/registration password failure at its root (auth flow, payload, error mapping).
- Optional **District** field on profile and address.
- Profile shows real **Verified / Not-Verified** email state from the backend, with a resend action.
- OTP: expiry, single use, rate limits, server-side verification only (existing MSG91 flow audited and tightened).

## Phase 3 — Content systems (items 2, 3, 10, 12, 13)

New tables + admin screens, with professional empty states and no invented content:
- **FAQs** — accordion on the intended page, admin-managed.
- **Careers** — programs/jobs with title, description, eligibility, location, apply action.
- **Blogs** — listing, detail, slug URLs, cover, excerpt, date, admin-managed; existing posts migrated into the table.
- **Social links** — editable in admin settings; unset icons hidden instead of `#`.
- Additional picture/content box on the homepage driven by the existing CMS blocks mechanism.

## Phase 4 — Compare + homepage animation + popups (items 1, 11, 12, 21)

- Rework the intro animation so the logo renders sharp (correct aspect ratio, no blur filter on the mark) and stays responsive.
- Make the second popup match the first popup's width, with no mobile overflow.
- **Compare**: add-to-compare on cards and PDP, persisted compare tray, side-by-side spec page, remove one / clear all, duplicate-safe, mobile-friendly.

## Phase 5 — Payments + notifications + partner workflow (items 20, 23-25)

- Harden payment flow: server-computed amounts, server-side verification, idempotent webhooks, correct handling of success/failure/cancelled/pending, transaction IDs stored, honest status pages.
- Welcome notification (email/SMS/WhatsApp) after verified signup, template-driven, non-blocking, de-duplicated.
- Security notification email on password/email/mobile change, with verification for email/mobile changes.
- Retailer/Distributor onboarding end to end: application → OTP → pending → user + admin notification → admin review (approve/decline, notes, history) → role + pricing granted **server-side only**.

## Phase 6 — QA pass

TypeScript + build check, route sweep, console-error check, responsive sweep at 320/375/430/768/1280, and the full workflow list from the brief. Final report with COMPLETED / PENDING / TESTED.

## Notes on external dependencies

WhatsApp delivery and transactional email sending depend on provider credentials. Where a provider is not yet configured, the code path ships complete and logs the delivery attempt rather than faking success — that will be listed under PENDING.

## Technical notes

Migrations for `decorative-lights` category remap, `faqs`, `career_programs`, `blog_posts`, plus profile/address `district` columns — each with GRANTs and RLS (public read for published content, admin write via `has_role`). Content reads go through public server functions or anon-safe policies; all privileged writes stay in server functions behind `requireSupabaseAuth` + role checks.
