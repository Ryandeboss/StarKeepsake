# Manual Amazon sourcing — owner workflow

This feature is independent of Amazon Business API approval. The owner purchases parts manually in their own Amazon account.

## Paid order to sourcing checklist

1. Existing M2 Etsy webhook or the **Sync Etsy now** admin action imports paid receipts; the owner-only Production Studio displays the manual checklist.
2. Verified paid, non-canceled, unrefunded, matched single-unit production jobs can contribute quantities. Orders with ambiguous designs or missing jobs are held for review.
3. Paid jobs without a prepared M3 BOM show **action needed**. The owner must confirm a frame recipe and prepare the job BOM first.
4. The list uses physical M3 on-hand counts and recorded outstanding supplier orders to calculate uncovered shortages, with caution flags on incomplete paginated sources.
5. A saved enabled Amazon ASIN opens its product page; an unmapped SKU opens an Amazon search. Neither action buys anything. Verify the product, pack count, availability, total price including shipping and tax, and frame compatibility.
6. The owner personally purchases the parts at Amazon.
7. After Amazon confirms the purchase, the owner enters the actual Amazon order reference and quantity of usable M3 units. The pre-existing M3 supplier purchase API records them as **ordered**, not received. A client-side same-SKU/reference duplicate guard and stable UUID for timeout retries reduce accidental duplicates.
8. Upon actual delivery, record receiving separately through the existing M3 Materials panel. Do not count shipped but undelivered goods as stock.

## Limits and operational details

The queue refreshes every two minutes while the Production Studio is open, without triggering an Etsy sync or Amazon purchase. If the Etsy webhook has not imported the order, the owner uses **Sync Etsy now**. No new email, phone, SMS, or background push notification is implemented, and an unopened browser receives no alert.

This release adds **no new database migration**, supplier price claim, product ASIN, catalog seed, customer checkout action, shipping/buyer credential, or automated order mechanism. The M3 supplier reference is not database-unique across all purchase records, so manually confirm that the same order/SKU has not already been entered.

Future M6.2 and M6.3 draft work can be rebased on this deployed manual path. Before the first sale, verify physical parts and populate actual M3 recipes, on-hand inventory and manufacturer-verified supplier mappings.

Acceptance: run npm run test:manual-amazon and npm run build from apps/web.
