# StarKeepsake M2 — Etsy paid orders and production register

STATUS: Feature branch only. Do not merge/deploy without explicit release approval.

## What M2 does
- Reuses the existing read-only Etsy OAuth connection (scopes: shops_r, listings_r, transactions_r), with no Etsy order/listing/payment writes.
- Uses Etsy GET shop receipts and GET receipt transactions, not webhook claims, as payment and personalization sources of truth.
- Imports only sanitized receipt/transaction fields into the StarKeepsake Supabase database. No buyer emails, addresses, private photos, notes or raw Etsy JSON are stored.
- Matches one Design ID against saved customer_designs. Etsy transaction personalization is read from variations with property_id=54, regardless of seller-configured label.
- A job is created only for one unit with one valid saved Design ID on a genuinely paid, non-canceled, non-refunded receipt. Initial job status is awaiting_review, never automatic manufacturing. All other cases need review.
- Supabase SQL RPC m2_ingest_etsy_receipt ingests atomically and idempotently. It is SECURITY INVOKER, service_role-only, all tables have RLS and no anon/authenticated grants.
- The private dashboard is available at /admin/production after the frontend release. Enter the existing Etsy admin setup key (not the Etsy Shared Secret or Supabase secret). The key remains in memory only, never browser storage.
- Sync Etsy now checks 10 latest updated receipts (maximum 25); includes cancellations. Dashboard supports filtering, item details and CSV export.
- Optional Etsy webhooks for order.paid, order.canceled, order.shipped, order.delivered. Signature and 5-minute timestamp verified; full Etsy receipt is re-read server-side. Until configured, webhook endpoint returns 503.

## Database setup
Target Supabase project: jckopgmyyhevrjmeibjk (the dedicated StarKeepsake project only).

1. Apply infra/supabase/002_etsy_production.sql as a migration.
2. Verify four RLS-protected tables: etsy_receipts, etsy_order_items, production_jobs, etsy_webhook_deliveries.
3. Verify role privileges: service_role can read and write; anon and authenticated cannot.
4. Run Supabase Security Advisor. The INFO advisory "RLS enabled, no policy" is expected on intentionally server-only tables.

## Backend and frontend release gates
1. dotnet build StarKeepsake.slnx --configuration Release
2. dotnet run --project tests/EtsyProduction.Tests/EtsyProduction.Tests.csproj --configuration Release
3. Existing Etsy OAuth, M1, frontend lint/build and design engine CI checks also pass.
4. Merge only after owner approval. Any API change on main triggers Azure Container Apps deployment.
5. Verify admin auth, GET orders, manual sync, and database states without placing test purchases.
6. Real paid-order matching requires the customer-facing M1 Save Design UI (still in draft PR #54), and a real Etsy listing collecting the Design ID. They are not released by this M2 branch.

## Webhook setup (for automatic sync)
Etsy Developer Portal > Your Apps > StarKeepsake app > Webhook Portal > Add Endpoint.
Endpoint:
https://starkeepsake-api-dev.wittyflower-9225f265.centralus.azurecontainerapps.io/api/webhooks/etsy/orders

Select order.paid, order.canceled, order.shipped and order.delivered. Obtain the separate whsec_ signing secret from the webhook portal. It is NOT Etsy Keystring, Shared Secret, OAuth token or admin key.

In Azure Cloud Shell Bash, store it without printing the value:

    read -r -s -p "Paste Etsy webhook whsec_ key (hidden): " WEBHOOK_SECRET
    echo
    az containerapp secret set -g rg-starkeepsake-dev -n starkeepsake-api-dev \
      --secrets "etsy-webhook-signing-secret=$WEBHOOK_SECRET" --output none
    unset WEBHOOK_SECRET

After the M2 backend is deployed, bind that existing secret to the app (creates a new revision):

    az containerapp update -g rg-starkeepsake-dev -n starkeepsake-api-dev \
      --set-env-vars Etsy__WebhookSigningSecret=secretref:etsy-webhook-signing-secret --output none

## Endpoints
- GET /api/admin/production/orders — X-Starkeepsake-Admin-Key header required
- POST /api/admin/production/sync?limit=10 — same admin key; 1–25 receipts allowed
- POST /api/webhooks/etsy/orders — Etsy raw signed body + webhook-id, webhook-timestamp, webhook-signature

## Price and limitations
Etsy receipt grandtotal amount/divisor/currency is the customer-paid total, including any shipping/taxes where applicable, not net income. M3 adds parts, inventory and margin.
The dashboard currently reads the latest 100 receipts, 300 items and 300 jobs; pagination is future work. A single customer Design ID for multiple purchased units is flagged for manual review. No Amazon purchases or laser/LED manufacturing actions are performed. Manual sync only covers recent receipts; schedule reconciliation before real scale. Admin setup key is an owner-only MVP mechanism and should later become MFA-backed admin Auth.

Official Etsy API references:
https://developers.etsy.com/documentation/reference/
https://developers.etsy.com/documentation/essentials/webhooks/
https://developers.etsy.com/documentation/tutorials/personalization-migration/
