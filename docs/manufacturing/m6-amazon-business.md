# M6.1 — Amazon Business procurement groundwork (DRAFT)

This milestone is deliberately **simulation only**, with no vendor API call or ability to place orders.

## Amazon Business official integration requirements (verified November 2026)
- Developer onboarding approval, account authorization and Login with Amazon OAuth.
- Business Product Catalog role for Product Search/offers.
- Amazon Business Order Placement role for Ordering API.
- Buying group, authorized buyer, shipping address, payment method and safeguards.
- Current provider operations: Product Search/Offers API; Ordering API `POST /ordering/2022-10-30/orders`, `GET /ordering/2022-10-30/orders/{externalId}`.
- Order calls require unique external IDs, line items, order attributes and price expectations.
- Sources: https://docs.business.amazon.com/docs/product-search-api-overview
  https://docs.business.amazon.com/docs/ordering-api
  https://docs.business.amazon.com/docs/placing-an-order
  https://docs.business.amazon.com/page/release-notes-2026

## M6.1 code included in this draft
- Private Amazon ASIN mapping with per-pack quantity and maximum unit price cap, stored by server-only Supabase RPC. M6 migration 004 depends on unapplied M3 migration 003.
- Owner-only GET `/api/admin/procurement/preview` and POST `/api/admin/procurement/mapping`.
- M2+M3 eligible paid job BOM aggregation, exclusion of canceled/refunded/held/unpaid jobs, on-hand reduction, pending supplier order reduction, rounding pack counts, M3-based rough costs.
- Refusal flags for missing offers, pricing, mappings, spend authorization, paginated/incomplete data.
- Owner UI `Procurement readiness` beneath the existing M3 Materials panel.
- Automated tests for paid/unpaid cases, existing inventory, open supplier orders, package rounding, invalid ASIN and permanent simulated checkout lock.
- No secrets, Amazon OAuth tokens, customer private design keys, buyer information, order address, shopping cart or purchase endpoint.

## M6.2 remaining release requirements
1. Register/approve an eligible Amazon Business account and applications.
2. Implement **read-only** server-side LWA OAuth + Product Search API offer verification (ASIN, offer identifier, seller, packaging, currency, availability, shipping, taxes). Update supplier costs only after provenance/freshness validation; do not interpret handwritten M3 costs as vendor quotes.
3. Build an immutable, auditable purchase-intent ledger, idempotent external IDs, owner approval and revocation, price drift thresholds, per-order/day budgets, payment safeguards and manual spending kill-switch.
4. Add gated Ordering API execution only with an explicit owner-controlled action/approved account; after uncertain timeouts, query orderDetails before retrying. Track delivered/rejected/returned products and reconcile M3 inventory.
5. Validate Etsy listing price and actual paid transaction, refund/cancel state, supplier stock count, per-order balance, shipping, and original photo safety before a live pilot.

**Deployment:** PR must remain draft; do not apply migrations, merge, order, authorize spend or alter Etsy until separate release approval. No production data touched in M6.1.
