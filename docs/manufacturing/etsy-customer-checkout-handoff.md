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
3. Customer sees a simple 2-step checkout guide: **Copy my Design ID** and
   **Continue to Etsy**. No downloads or uploads required. The public SK ID is
   a lookup key, never a private asset access key.
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
File upload is deliberately **not** part of the customer handoff. If Etsy has
a file-upload custom option on the listing, buyers may ignore it if optional;
the required text Design ID is sufficient. Etsy's newer Custom options can return
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

## November 19, 2026 — current buyer experience (supersedes earlier PNG steps)

Owner decided buyer PNG downloads and file-upload instructions add friction.
Chapter 05 **Save design & prepare Etsy order** now preserves the existing
private saved photo, selected astronomical/physical stars, frame choice, and
server-frozen full manufacturing ZIP. After preparation the customer sees only:
1. **Copy my Design ID** (the actual server-issued SK code displayed prominently).
2. **Continue to Etsy**: paste the SK code into Etsy's **"StarKeepsake Design ID"**
   text field, select the same finish, and check out with Etsy. No file or
   photo needs to be uploaded. The button is no longer an automatic PNG download.

A small closed disclosure allows an *optional* ZIP backup, not needed for
checkout. The private reopening link remains separately tucked away.
Customer's payment can only be confirmed by Etsy verified webhook/manual sync;
a saved design alone is not a purchase. Maker's order-sheet PNG continues to
exist inside the **private** packet for shop use and is not provided or
requested in the Etsy buying instructions.

**Important Etsy listing prerequisite:** Make sure the actual listing has the
required **text** personalization named `StarKeepsake Design ID`; a file-only
Etsy listing cannot be automatically matched. Check finish variation and
actual listing price before accepting orders. Neither the payment flow nor
an intentional paid transaction has been acceptance-tested end-to-end.

## November 19, 2026 — Chapter 05 simplification, frame selection, progress and owner example

Owner requested **remove the "Make it yours" title and its marketing paragraph,
remove all prices from Chapter 05**, relocate both physical frame choices from
the left side of the showroom to **Your night, framed** directly below
**01 Choose your room**, and show a professional progress animation while
**Save design & prepare Etsy order** securely generates and freezes files.

Changes:
- Inside the **Your night, framed** side panel, **02 Choose your frame finish**
  now holds the two-tone walnut and matte-black swatches (plus legacy oak only
  when loaded from a legacy saved design); selecting a swatch keeps frame and room
  behavior. The left preview retains star illumination controls. The original
  price estimate card and numeric prices are absent from Chapter 05. Hidden
  internal quote metadata (non-binding) remains in the maker packet; actual
  amounts paid are available from Etsy on owner dashboard, not customer Stage 05.
- Customer checkout card keeps optional inscription, Save draft, and Save design
  & prepare Etsy order. A stage-driven orbit, loading ring and gentle progress
  track shows **save source/photo → render exact sky/prints/parts → private
  Vercel ZIP freeze**. It does not fake completion or unlock Etsy before archive.
  Interaction controls that affect the saved finish/text are disabled during save.
- A new **Read-only Sample Production Order** viewer lives only behind the
  existing owner login, below the real production metrics. Its demo identifier
  `SK-DEMO-NOT-REAL` intentionally fails the real paid-match regex and is
  obviously marked **SIMULATION · NO PAYMENT · NO DATABASE RECORD**. Opening it
  shows a hypothetical $799 Etsy sale, matte-black 11×14 above-photo print,
  Chicago moment on June 14, 2025 at 9 PM, 18 selected LEDs,
  1 TLC5947 board, 2 connector groups, 18 StarPods, 23 unstarted QA steps,
  sample purchase/material counts, print variants, and the actual types of
  private maker archive files. It makes zero network requests or data writes,
  never appears in Etsy paid counts, Saved Designs, real receipt register,
  supplier stock, shipping, or CSV; there is no real synthetic paid order seeded.
- Real paid-job data still shows actual Etsy receipt, verified payment amount,
  matched SK-ID, saved finish/layout, and private maker ZIP. Photo is not shown
  as a thumbnail in the listing; owner may retrieve source and print previews
  from authorized files. Candidate BOM always needs safety, supply and
  fit/alignment proof.

**Remaining acceptance:** manually preview both finishes/rooms and a Chapter 05
load, open owner sample after logging in, then deliberately purchase and match
a real Etsy order when ready. The example alone does **not** verify live Etsy
webhook/payment flow, printed star registration, hardware or supplier readiness.
