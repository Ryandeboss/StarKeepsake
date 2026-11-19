# Customer design → Etsy paid checkout → workshop order and sourcing

Status: **feature code ready; Etsy listing setup required before real customer checkout**.
As of November 11, 2026 the Vercel project had no configured VITE_ETSY_LISTING_*
variables, and no actual published Etsy listing/verified retail prices were established.
This feature does not create Etsy listings, process payments, or change existing designs.

## Customer-facing journey

1. Customer customizes a photo, real calculated star positions, time/location, sky layout,
   inscription and a current 11×14 finish (Two-tone walnut or Matte black).
2. At Chapter 05, **Save design & prepare Etsy order** ensures the complete photo,
   polished foreground where required, and design preferences are saved privately.
   Only the **server-assigned** `SK-[0-9A-F]{16}` ID can proceed. A temporary
   local packet checksum can **never** be used for a paid Etsy match.
3. Customer sees exact saved Design ID, private link, optional maker packet and
   optional order-sheet PNG. The public SK ID is not an asset access key.
4. Copy **only the SK code** into Etsy's required text Custom option named
   "StarKeepsake Design ID". Any extra photo upload/inscription options are
   separate. The buyer checks that Etsy's frame finish matches their saved choice.
5. Continue to the configured Etsy listing in a separate tab. Etsy handles
   buyer delivery address, payment and actual sale price. The website quotes
   remain **illustrative**, not binding or automatically synced to Etsy.
6. Existing Etsy order.paid webhook / manual Sync Etsy now fetches the actual
   paid receipt with seller OAuth and reads the SK code from transaction
   personalization. Only matched, single-unit, nonrefunded/noncanceled jobs
   become eligible for production.
7. Owner `/admin/production` sees Etsy order, matching saved design finish /
   sky layout, the job's BOM line items (if prepared), shared physical stock,
   and incoming supplier orders. Owner still must confirm Etsy variation matches
   saved finish before fabrication.
8. M3 Materials holds walnut / ebony physical recipe and allocations. Manual
   Amazon shopping checklist aggregates outstanding demand across eligible
   jobs, subtracts on-hand and supplier orders. Owner pays on Amazon personally
   and records purchase/receipt. No vendor purchases are automated.

## Mandatory Etsy listing setup

Create **physical made-to-order listings** in the connected shop. Recommended:
one listing per production-ready finish (Walnut / Matte black), each with true
shipping, processing, returns, tested product photos, and actual owner-approved
prices. Alternatively, one physical listing with a required **Frame Finish**
variation with two options, and buyer must reselect the same finish at Etsy.
Do not offer an untested physical prototype for sale.

Each listing must contain a **required text Custom option**, exact name
"StarKeepsake Design ID", max 40 characters, instructions:
"After customizing at StarKeepsake, paste only your saved SK-... Design ID.
Do not paste your private design link. Your photo is already saved securely."
Optional upload of order-sheet.png if desired: file uploads and inscription
options must be separate questions. Etsy's newer Custom options can return
multiple `property_id:54` records; the parser now accepts **exactly one**
standalone SK ID and ignores other notes/file URL fields. Multiple possible
IDs remain ambiguous and must be reviewed.

Set Vercel **project environment variables** (production, and optionally
preview), with URLs copied from the actual live Etsy listing page:
- `VITE_ETSY_LISTING_WALNUT_URL` = `https://www.etsy.com/listing/<actual-id>/...`
- `VITE_ETSY_LISTING_EBONY_URL` = `https://www.etsy.com/listing/<actual-id>/...`
- OR `VITE_ETSY_LISTING_URL` for one shared listing with explicit Etsy
  frame finish variation; buyer must select same finish again.

Only HTTPS www.etsy.com/etsy.com **listing** URLs are accepted; shop homepages,
offsite redirects, login/cart links and URL query/fragments are refused.
Without configured listing URLs, public Etsy checkout stays **disabled** and
the design remains safely saved. Adding env variables requires a new Vercel
production frontend build.

The currently offered walnut/black $799/$899 website estimates are
planning figures, NOT necessarily actual Etsy listing prices. Do not configure
a live paid product until physical BOM, fulfillment viability, and the listing's
actual price are approved. Natural oak remains a legacy preview option and
cannot check out as a current product.

## Verification gates

- `npm run test:etsy-checkout`, `npm run test:studio-preservation`, `npm run build`.
- API `tests/EtsyProduction.Tests` validates multi-Custom-option parsing.
- Integration acceptance test: save a test design, copy exactly the Design ID,
  verify correct Etsy listing and variation, manually check Etsy checkout
  (without accidentally placing a real order), then use a legitimate paid test
  purchase or sandbox-fixture replay to validate the linked production order.
- Do not log customer keys, copy private asset links to Etsy, seed imaginary
  stock/ASINs, create purchases from previews, or infer payment from a saved
  design. Webhook and manual sync remain the only paid-order sources.

Future: connect Etsy listing price/variation verification for exact-priced
order commitments, and owner emails when actual paid jobs arrive.

## November 19, 2026 — buyer PNG handoff and paid ID dashboard

Chapter 05 now auto-downloads an Etsy-compatible PNG design card *after* saving
the exact design and securely freezing its full manufacturing ZIP. The card
includes the server-issued public Design ID, actual photo/sky visual, selected N
illuminated stars, date/location/time, orientation, frame finish and inscription.
The owner still retrieves the exact saved photo, HIP star map, print variants,
parts/candidate BOM and checklist through the private frozen ZIP of a verified
paid and matched Etsy job. The public card is NOT manufacturing artwork.

Etsy supports PNG file uploads but transaction upload personalizations are URLs,
not dependable design IDs. Enter the SK ID into the Etsy text personalization
for automated matching; the PNG upload is an **optional visual reference**.
A file-only buyer upload is an unmatched paid order needing seller review.
The private design reopening link MUST NEVER be pasted into Etsy.

The Production Studio has an at-a-glance Purchased Design IDs list, filtered
to actual Etsy-paid, noncancelled, nonrefunded, single-unit matched jobs; click
through for receipt details and owner-only files. All items remain subject to
physical print/electrical/procurement proof before fabrication.
