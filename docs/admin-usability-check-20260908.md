# Admin usability and reliability check — 2026-09-08

Status: source improvements implemented; static checks pass; authenticated runtime verification REQUIRED. This is not a claim that the entire admin works end to end.

Scope: existing `codex/phase-2a-admin` branch only. Preserve existing routes, permissions and workflows. No production records, database migrations, checkout, payment providers, shipping integration or storefront changes in this update. Existing shared Button, Command, Dialog and Sheet components were reused.

## Confirmed source defects fixed

| Area | Defect | Change |
| --- | --- | --- |
| Navigation | Active sidebar groups could not collapse; Shipping also matched Shipping Rules | Route-segment matching; expand group on navigation but allow manual collapse |
| Client navigation | Finding tools required searching every dropdown | Find a page dialog, Ctrl/Cmd K, mobile search, four dashboard task shortcuts |
| Mobile menu | Custom overlay lacked the existing modal focus management | Reused Sheet with focus trap/Escape; sidebar-specific styling, 44px navigation targets, skip link |
| Data failures | Some rejected page queries looked like empty tables | Shared active-query error banner and retry, offline warning; excludes storefront query keys |
| Dashboard | Supabase errors became zeros; response limit could truncate totals; legacy product counts/stock | Error propagation, complete paginated reads, family counts and SKU availability after reservations |
| Dashboard chart | Unsorted month labels and an unresolved percentage height | Six chronological UTC calendar months, explicit chart height, horizontal mobile overflow |
| Metric labels | Non-cancelled order totals called revenue regardless of payment status | Label as order value, explicitly not net paid revenue; calculation semantics preserved |
| Realtime | Callback could retain old filters/draft state; channel names reused across owners | Latest callback ref, unique channels per subscription, disposal isolation and reconnect refresh |
| Realtime feedback | Inventory asserted live updates unconditionally | Connection state and manual refresh; a connected channel is not proof of delivery |
| Variant drafts | Options unmounted when switching pricing tabs | Keep the option editor mounted; show unsaved state; warn on route exit/reload |
| Variant saves | Save Variants could ignore unsaved option definitions; edits allowed during save | Prompt to save options and current SKU details together; disable editing during in-flight save |
| Variant identity | Retry could resubmit draft identities after successful save; manual default was an active zero-priced row | Await refreshed SKU IDs; inactive blank-priced manual drafts; avoid locally duplicate draft codes |
| Saved SKU field | UI allowed renaming an ID which the safety routine intentionally rejects | Read-only saved SKU with explanation; new draft SKU and variation name/options remain editable |
| Inventory groups | Closing the currently expanded family reopened it | Allow all families to remain collapsed; refresh related admin caches after stock adjustment |

Shared error recovery only sees queries that throw. It does not establish that every legacy query or mutation has correct error handling. No broad silent fallback was added.

## Checks and evidence

- `node --test src/lib/variant-options.test.mjs src/lib/admin-workflows.test.mjs`: 16 passing tests. Synthetic, in-memory fixtures only.
- New regression coverage: segment matching, admin-only error key selection, subscription cleanup/reconnect, over-1000-row pagination, lower page limits, missing/changed counts, query failures and chronological calendar summaries.
- `./node_modules/.bin/tsc --noEmit`: passed.
- `npm run build`: passed (existing dependency/deprecation warnings remain).
- Targeted ESLint on changed TypeScript/TSX: passed.
- `git diff --check`: passed.
- 35 existing admin route source files remain (including the parent shell); no routes were removed or replaced. The build compiles the application, but does not exercise route actions.
- No authenticated browser walkthrough, database save, order, refund, shipment or media upload was executed in this pass. A sign-in gate or HTTP 200 would not satisfy those checks.

## Integration requirements

This workspace has no configured `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`. Supply configuration through the authorized environment, not chat. A signed-in admin session and safe test database are required for write tests. Lovable preview must not be assumed separate from production.

No new migration is introduced in this update, and no migration was applied. Previously prepared migrations remain prerequisites, notably:

- `20260906190000_phase2a_catalog_integrity.sql`: family publication, inventory and catalog integrity dependencies.
- `20260907160000_product_admin_parity.sql`: catalog options, state actions, SEO/shipping/refund data and v2 routines.
- `20260908130000_variant_save_safety.sql`: v3 variant save, stock safeguards and compatibility projection.

Inspect the target migration history and the complete existing dependency chain before applying anything. The missing parity/v3 database routines cannot be repaired by styling the page or repeatedly refreshing it. Do not run migrations against production under this task.

## Exact remaining runtime acceptance

| Module | Required checks on the authorized test environment |
| --- | --- |
| Shell / all sidebar destinations | Open every destination; collapse active groups; page search by click and Ctrl/Cmd K; keyboard navigation and focus return; mobile menu, Escape, 390px/768px/1280px layouts; no console errors |
| Dashboard | Compare counts and order values with database records; more than 1000 rows; correct SKU threshold/reservations; zero-data and failed-query states; monthly chart with missing months |
| Products / New Product | Open existing family and new form; required fields; save/reload; clear and restore draft; category change; archive/hide/restore/duplicate/bulk controls; all current metadata fields |
| Variations | Use actual Concealed, Track, Flood and a different-axis family; save options; generate twice without duplicates; select per-SKU Edit/Images; all role prices/MOQs, names, custom specifications, weights and dimensions survive reload |
| Draft safety | Edit options, switch each pricing/shipping tab and return; leave/stay prompt; reload warning; save with options dirty; network failure during save; successful write followed by failed refresh must not create duplicates |
| Stock integrity | Same SKU from variants and inventory; non-stock save preserves concurrent stock change; stale stock edit rejected; one ledger entry; stock reservations with concurrent orders |
| Media | Upload real allowed test images; SKU assignment, reorder, primary/fallback, reassignment/removal; two simultaneous editors; file failure recovery |
| Catalog options / categories | All Brands, Attributes, Colours, Warranties, Size Guides tabs; add/edit/active controls; permissions, duplicates and missing-migration behavior |
| Product Master / bulk tools | Search/filter/sort/page; selected-only edits; role pricing; draft restore/clear; CSV validate/import/export/rollback with authorized disposable test data |
| Orders / returns / payments / shipping | Search/filter/detail; allowed state transitions; idempotent operations; refunds and shipping only in configured sandbox or read-only mode; existing provider integrations unchanged |
| Customers / partners / affiliates / careers | Search, details, approval/rejection, role-pricing access, permissions and all existing row actions |
| Coupons / campaigns / content / editorial / reviews / support / carts | All tabs, filters, forms and row/bulk actions; loading/error/empty states; actual persisted result and permissions |
| Reports / audit | Date boundaries, totals and completeness; filters, exports, pagination and responsive tables; verify report permissions |
| Settings / roles / security / integrations / shipping rules | Read with authorized role; verify denial for other roles; only non-production allowed configuration changes; no credentials in browser payloads or logs |
| Realtime / recovery | Two authenticated sessions; changes appear in the other; disconnect/reconnect refresh; dirty forms are not overwritten; old filters are not used; no duplicate channels; retry only active failed admin queries |

The dashboard deliberately refuses a client-side overview above 50,000 rows instead of showing a truncated total. It is not a transactionally consistent multi-query snapshot; use database-backed reports for reconciliation. Large-catalog server aggregation remains a future optimization.

Existing risks from `product-variant-master-status.md` still apply: actual old-catalog mapping is unverified, other legacy stock-write callers need concurrency testing, and multi-step image operations need transactional/failure testing. These are not fixed or verified by this usability update.
