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

## M6.2 update — read-only Amazon Product Search adapter, November 11, 2026

**Implementation status:** New draft code supports provider-authenticated, read-only Amazon
Product Search ASIN batch lookups. The owner must still obtain Amazon Business
developer approval, app roles and access/refresh credentials. No live Amazon
offers have been returned or verified yet. No supplier transactions are enabled.

### Onboarding (Amazon Business must approve access first)

1. Enroll an eligible Amazon Business account and create/register an API client
   with the Amazon Business Developer / App Center workflow.
2. Request **Business Product Catalog** role and obtain consent from an actual
   buyer account in the appropriate Amazon Business buying group. The account
   must have permission to view products and their offers.
3. Complete LWA authorization; obtain a refresh token using Amazon's official
   authorization-code process. Do not paste tokens into ChatGPT or GitHub.
4. Store these only as Azure Container Apps **server-side secrets / env vars**:
   - AmazonBusiness__EnableCatalogReads=true
   - AmazonBusiness__ClientId=(LWA app ID)
   - AmazonBusiness__ClientSecret=(LWA app secret)
   - AmazonBusiness__RefreshToken=(consented buyer's refresh token)
   - AmazonBusiness__BuyerEmail=(authorized buyer email)
   - AmazonBusiness__GroupTag=(optional; only for multi-group accounts)
5. Redeploy/restart the API after secret configuration and verify owner-only
   GET /api/admin/procurement/catalog/status. The status endpoint does not
   reveal secrets. RoleConfirmed is true only after a successful provider read.
6. In the Production Studio, first map real parts and ASINs with pack quantities;
   click **Check featured offers** to use the read-only
   POST /api/admin/procurement/catalog/quotes/refresh.
7. Independently confirm correct product, merchant, offer, condition, stock,
   physical pack size, and shipping/tax. Never interpret this estimate as a
   guaranteed checkout price or a physical manufacturing BOM certification.

### Protocol, scope, safety

- Fixed NA region endpoint:
  POST https://na.business-api.amazon.com/products/2020-08-26/products/getProductsByAsins
  with productRegion=US, locale=en_US, facets=OFFERS, authorized buyer header
  x-amz-user-email and LWA x-amz-access-token; max 20 mapped ASINs in one call.
- Refresh LWA through POST https://api.amazon.com/auth/o2/token on the server.
  Access token lives only in server process memory, is never put in browser,
  database, URLs or logs. HTTP redirects are disabled on both clients.
- Account must supply Amazon-approved API role; configuration alone does not
  prove role access. 403 and 401 return a generic, non-secret diagnostic code.
- The owner explicitly initiates a read; cached provider results expire after
  ten minutes, and fresh provider calls have a 120-second cooldown per API
  instance. On network/provider error, fail closed without placing an order.
- Each quote includes ASIN, SKU, offer ID, seller, product title, observed
  USD pack-price and calculated catalog-unit price. Status flags warn on
  non-USD/missing prices, purchase restrictions, used condition, stock and
  max-unit-price violations, missing pack verification and shipping/tax.
- The M3 catalog, saved designs, purchase ledger, Etsy listings and customer
  prices are never modified by these lookups. Quote response is not persisted.
- There is **NO** Amazon Ordering API method, route or purchasing credential
  requirement in M6.2. Missing provider access is a normal locked state.

### Verification and limits

The C# test project tests/AmazonCatalog.Tests exercises parser validation,
non-USD rejection, ASIN mismatches, buying restrictions, unit-price ceilings,
LWA token refresh through mocked HTTP, cache/cooldown and disabled-mode blocks.
GitHub CI builds the API and runs all C# tests. Preview frontend code can be
reviewed without credentials, but live offer retrieval cannot be tested until
Amazon approves and authorizes the account.

Official reference:
- https://docs.business.amazon.com/docs/initiating-a-search
- https://docs.business.amazon.com/docs/product-search-api-overview
- https://docs.business.amazon.com/docs/amazon-business-roles
- https://developer.amazon.com/docs/login-with-amazon/authorization-code-grant.html

**Next after access is verified:** manual supplier catalog reconciliation, immutable
purchase intents, approval/cost caps, quote freshness and quantity checks,
stable external IDs and refund/return/delivery reconciliation. Only then
consider a separate, explicitly authorized purchasing pilot.
