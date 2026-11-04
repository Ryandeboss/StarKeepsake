# StarKeepsake | Customer purchase and maker handoff
This staged checkout UI exports an unpaid preview order packet on the customer's own device. No database, payment or Etsy/Amazon purchasing automation is active yet.

## Customer packet
- `order-sheet.png`: visual reference with the chosen moment, direction and design reference, for Etsy file-upload personalization.
- `original-photo.jpg/png/webp`: full original resolution.
- `prepared-foreground.png`: polished transparent photo for *within image* compositions, if selected.
- `order.json`: complete canonical DesignSpec, calculated catalogue stars, exact moment/time zone, perspective and settings in millimeters.
- `HOW-TO-ORDER.txt`: checkout instructions and matching reference.

`SK-<12hex>` is a deterministic SHA-256 prefix of source photo bytes plus canonical design and settings. **It is not a persistent retrieval ID, proof of payment or permission to start manufacturing.** Buyers must supply their order files alongside the code.

The browser's **Continue to Etsy checkout** action is deliberately gated behind `VITE_ETSY_LISTING_URL` and only accepts real `https://www.etsy.com/listing/...` or `shop/...` URLs. Set the actual listing on the preview deployment after the shop is ready. Do not invent a listing.

## Etsy listing setup
Use Etsy Custom options: text design reference, file upload for order-sheet.png, original photo and prepared foreground (when applicable), and optional inscription. Etsy now supports 5 typed custom questions and 10 files in one upload question. The buyer must pay on Etsy, not by email or another off-platform method. Use product photos of **real built prototypes** as the listing main images; gallery renders are illustrative.

## Pending server work, before opening sales
1. Confirm hardware prototype, LED placement map, sizes, actual supplies, safe power, price and lead time. Validate BOM and real Amazon ASINs/vendor offers.
2. Decide physical finish/size SKUs and fixed Etsy listing price. Preview finish options are *illustrative*, not an accepted order for unverified materials.
3. Connect approved Etsy Open API v3 OAuth 2.0 + webhook `order.paid` with signature verification and idempotency; reconcile Etsy personalization files to manifest reference; securely store customer files (access control, retention/deletion, backups).
4. Create a protected staff-only job dashboard in Supabase: `etsyOrderId`, `designReference`, `paidVerified`, `partsReserved`, `neededItems`, `amazonPurchaseIds`, `expectedDelivery`, `receivedQty`, `assembly`, `qc`, `shipped`, `tracking`. One incoming part can be shared among multiple jobs; allocate stock explicitly.
5. Only after payment verification and budget/quantity/stock safeguards, connect approved Amazon Business Ordering API access. No automated orders without the owner's explicit purchasing authorization and a tested approval threshold.
6. Produce the actual manufacturing assets in mm using the canonical backend DesignSpec. Physical lights should highlight ~20–30 significant stars, not every digital preview dot; hold to a proven printed-star template and Pico LED mapping.
7. Test order cancellations/refunds, out-of-stock suppliers, shipping damages, photo rights/privacy, returns and physical electrical quality; launch only after rehearsed end-to-end sample Etsy orders.

This current packet does not turn the astronomical preview into a validated production-ready laser engraving file. It preserves the inputs for a later factory design-engine render.

## Customer final chapter
After choosing sky perspective in 04 / Your Sky, customers continue to 05 / Your Keepsake. This is a simulated, styled room with independent room presets, warm walnut / natural oak / ebony oak swatches, and a stars-on/off preview. The selected frame finish is captured in the exported manifest and Etsy personalization text, not the decorative room style. The main CTA generates **unpaid** locally downloaded files. A verified Etsy listing URL must be configured before any live Etsy handoff can appear; no actual online purchase happens here.
