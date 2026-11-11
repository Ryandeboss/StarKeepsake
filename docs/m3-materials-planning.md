# M3 — Owner-only materials planning, manual stock and job-specific BOM

**Status:** Draft only; do not merge or deploy without release review. Never runs purchases.

- A manually curated material catalog (SKU, unit, unit price in cents or unknown, supplier URL/name, reorder threshold). No speculative prices or default manufacturing materials are seeded.
- A manual inventory quantity ledger. A positive/negative adjustment records an actual physical count change, never a supplier order. Each update uses a UUID idempotency key; stock cannot go negative.
- Wood-finish-specific BOM recipes, with fractional units and waste percentage. Existing job plan snapshots are immutable when recipes/prices change.
- A verified-paid M2 Etsy job, matching saved customer design and finish, can receive a **draft** material plan. Cancellation/hold prevents creating a new plan. No automatic stock decrement, supplier contact, Amazon checkout, CNC/laser job or manufacturing status change.
- Dashboard is inside existing owner-only /admin/production login. Materials and order data use the same protected Etsy AdminSetupKey. Do not expose sb_secret key in browser.
- Shortage calculation aggregates required quantities across active draft plans against physical stock; does not reserve materials. Estimates exclude shipping, labor, taxes and miscellaneous costs; unknown part prices make the total incomplete.
- Per-order plans are not generated for synthetic/unpaid/missing-design orders. No SKU/prices can be inferred from an image or from an Etsy listing without owner verification.

## Storage and deployment
- Pending migration: infra/supabase/003_materials_planning.sql. Apply ONLY to Supabase project jckopgmyyhevrjmeibjk when approved.
- All six tables RLS-enabled and revoked from anon/authenticated. SQL RPCs SECURITY INVOKER, executable only by service_role.
- Existing Azure API has Supabase secret refs; no new secrets required. Order list and OAuth continue to function.
- M3 API:
  - GET /api/admin/materials
  - POST /api/admin/materials/catalog
  - POST /api/admin/materials/stock
  - POST /api/admin/materials/recipes
  - POST /api/admin/materials/plan
  All require X-Starkeepsake-Admin-Key. No public routes, no payments, no supplier calls.
- Verify API/React/Design Engine CI, apply SQL as migration, check access and endpoint auth, then release only with owner approval.
- A real confirmed paid Etsy order is required for final end-to-end BOM testing. Synthetic SQL tests must run within ROLLBACK and must not create production jobs or paid Etsy transactions.
- Do not update handoff docs via Git commits. Update living issue #58 instead, with no Vercel build.

## Owner QA (after release)
1. Enter a real SKU, unit, supplier and price (or Unknown) and set reorder threshold; refresh and verify persistence.
2. Add +5 inventory with a reason; check updated count; submit -2; ensure stock nonnegative. Do not retry a timed-out adjustment without checking state.
3. Build an oak/walnut/ebony recipe; edit it and verify existing job snapshots don't change.
4. For real paid matched Etsy production job, generate draft BOM; confirm finish restriction, quantities (including waste) and estimated costs. Re-prepare same job should not duplicate.
5. Verify unmatched, refunded and canceled jobs are blocked, and live purchases/physical inventory are unaffected by preparing a BOM.
6. Verify no customer PII or private photo links appear in materials UI/export.

## M3.1 manual supplier-order tracking and allocations (integrated draft)
- Owner records a real supplier order confirmation and SKU/quantity, or records a partial/complete delivery. Logging an order NEVER sends a checkout request or pays a supplier.
- Immutable UUID purchase/receipt IDs; receipt retries are idempotent. Physical receiving increases on-hand stock once, writes the ledger, and disallows receiving more than ordered.
- Per-paid-job allocation reserves a quantity for a specific SKU on an immutable BOM. The allocation transaction locks the SKU row, checks Etsy paid/nonrefunded/matched job status, enforces required quantity and available stock, and permits setting zero to release the reservation. Canceled/refunded/held jobs cease counting as active allocations.
- Manual negative stock adjustments cannot reduce stock below allocations for active paid jobs.
- All 3 new tables are RLS enabled, revoked from anon/authenticated and accessed only by the server's existing admin-key protected endpoints. New SQL functions are SECURITY INVOKER, restricted to service_role.
- Supplier prices are still manually entered in the catalog; no live vendor pricing feed, supplier payment or fully automatic replenishment in M3. That is a separate M6 integration.
- Actual Etsy variation prices are independent. New FramePricing API is an **estimate**, and neither it nor draft M3 publishes an Etsy listing. Release requires integrating the two branches, applying and verifying migration 003 once, then deploying API/frontend with owner approval.
