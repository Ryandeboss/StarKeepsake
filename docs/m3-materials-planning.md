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
