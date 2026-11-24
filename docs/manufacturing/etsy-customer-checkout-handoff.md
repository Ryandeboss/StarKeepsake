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

## November 20, 2026 — focused workbench-UX upgrade for the *sample* admin order

Owner attached a production-work-order UX guide and explicitly asked to **improve
the existing example without rebuilding the dashboard**. Inspected current live
`ProductionDashboardPage`, `SampleProductionOrder`, `OwnerProductionFiles`,
`OwnerManufacturingPlan`, Etsy paid design matching, per-design maker plan,
M3 inventory/purchasing and the 23-step server-saved checklist before changing code.

Changes are intentionally limited to the **read-only simulated order**, styling
and regression checks; no backend, Etsy, real jobs or stock model is changed.

- First screen shows clear **PRODUCTION HOLD**, immediate next action and three
  real-world validation blockers — never a false “Ready to Build”.
- Customer summary shows example frame, 18 physical lights, moment, finish,
  inscription and paid/ID fields beside an **explicitly illustrative** frame
  placeholder. No fake personal photo or fabricated HIP coordinates.
- Main **Files** section identifies the **¼-inch-bleed master** from the existing
  `PRINT_VARIANTS` data (11.5×14.5 in, 300 DPI), *subject to print-lab
  acceptance*. Other print variants, source image, JSON, star CSV and draft
  drill template are accessible in a collapsed technical file list, not
  counterfeit working Download buttons.
- Parts summary derives `N=18`, 18 LEDs/StarPods, `ceil(N/24)=1` driver and
  `ceil(N/12)=2` connector groups, followed by expandable **Buy**, **Pack**,
  **Bulk**, **Make** examples. All on-hand/supplier statuses are clearly
  **unknown/unverified**, never inferred stock quantities or invented orders.
  Full genuine job BOM remains computed by `buildManufacturingJobPlan`.
- Build section defaults to the first four steps and `0/23` simulated progress;
  complete original `MAKER_STEPS` list is expandable. Genuine checklist
  remains server-persisted; the sample cannot check off anything. QA and
  shipping have separate simple **not started/not ready** sections. Advanced
  engineering data is collapsed last.
- Demo remains only inside existing admin-key-protected Production Studio with
  invalid `SK-DEMO-NOT-REAL` ID and visible **SIMULATION ONLY** warning. No
  synthetic receipt or saved-design record, no API call, no inventory
  write, no Etsy/payment/shipping mutation. Actual paid jobs are unchanged.
- Deferred real-job gaps from the user's broader guideline: embedded
  verified customer preview, per-job allocated-vs-available inventory
  aggregation and statuses, dedicated QA failure notes/photo upload, verified
  shipping state transitions and conditional print/geometry approval gates.
  These require separate model/UX design and testing, not cosmetic demo data.

No physical build approval is implied by this sample. Real orders continue to
require payment matching, correct saved finish, print/LED geometry verification,
approved electrical/power/thermal parts, calibrated drill placement and
supplier review. One GitHub feature push / one Vercel production deployment
target; update issue #58 with tested commit and final CI/deployment status.

## November 23, 2026 — owner-authorized real-design simulated purchases

Owner requested **replacing the hard-coded sample as the only test path with a
repeatable real-design exercise**: finish any Chapter 05 keepsake, press
**Simulate Etsy Purchase**, see the exact saved design as a persistent TEST work
order in the admin dashboard, use the actual maker ZIP, print files, selected
physical stars and BOM, persist test-only checklist progress, and delete
simulations later. Must NEVER falsify an Etsy payment or increment actual paid
receipt/production/supplier demand totals.

Architecture:
- New Vercel function `/api/production/simulate` stores private owner-only
  `production/simulations/orders/SK-...json` records containing an authenticated
  saved design reference (separate from Etsy and M3 sources of truth).
- Every request validates the same owner admin key with Azure's existing
  `/api/admin/designs` authority. POST additionally proves the private saved
  design edit key works via Azure `/api/designs/{id}` and that the exact
  `frozen-v1.zip` was privately archived. Cannot simulate with only an SK ID,
  no key, bad key, an unprepared design or a partially uploaded file.
- Owner GET returns only safe summaries (ID/time/finish/layout/N), never design
  edit keys or private blobs. GET view=design/photo/archive is owner-authenticated
  and proxies private saved assets or frozen maker ZIP. GET/POST view=checklist
  reads/writes the **same 23 step IDs but under a SEPARATE simulation namespace**.
  No test writes touch Etsy paid jobs, the actual Azure order register, or
  real production progress. DELETE removes only the simulation record and
  its test step records, not the source saved design or frozen ZIP, which could
  later support a genuine Etsy order.
- Chapter 05 shows a visually secondary **Simulate Etsy Purchase** owner-test
  button with owner key field. Submit calls the existing exact save/print/freeze
  path then creates the private simulation; clears key after success; shows a
  link to `/admin/production?testDesign=SK-...` without including any private
  key in the URL. No Etsy calls, charges, or purchases.
- Admin `Your simulated purchases` table is separate from genuine paid Etsy
  receipts and metrics and the old read-only hard-coded sample. Clicking a
  test opens `OwnerProductionFiles` in simulation mode and reused
  `OwnerManufacturingPlan`, which loads the ACTUAL saved design, displays the
  original photo, generates a combined photo+star proof and all three print
  variants, retrieves the immutable ZIP and exact N-dependent candidate BOM,
  1:1 draft drill reference, supplier links/stock snapshot, validation holds
  and independent persistent test checklist. A confirmed **Delete test** action
  removes its work-order record and isolated checklist only.
- Entire project still remains at *manufacturing proof / electrical verification
  HOLD*. A test checklist tick or simulation is not payment, allocated stock,
  certification, real order status, or shipping permission.
- Security warning: owner key entered for simulation is only sent to the
  owner-validated function, never logged, persisted in client storage, included
  in Etsy checkout, or appended to URLs. Private design access keys are never
  returned by the simulations listing or client read endpoints. Client/private
  test preview is owner-only. A saved design's original private editing URL
  remains separate.

Acceptance still needed manually: save a genuinely new real design in Chapter 05,
enter owner key and simulate, click the resulting admin link, confirm same ID,
photo, moment, finish, exact LED count/coordinates, original ZIP and print
variants, reload and verify test checklist progress, then delete the test and
confirm it vanishes while real Etsy counts stay unchanged. This is a true
end-to-end *simulation*, **not** a live Etsy payment verification. The physical
product still needs prototyping and safety/print proofs. Only one batched
GitHub push / Vercel production deploy planned.

## 2026-11-23 — Full per-design manufacturing rehearsal expansion

This extends the existing owner-only `/api/production/simulate` test-order
system; it does **not** create synthetic Etsy receipts, transactions, refunds,
paid metrics, orders to suppliers or real shipping events.

- **Frozen version, not regenerated guesswork:** The immutable private
  `frozen-v1.zip` is read on the owner dashboard using
  `src/frozenMakerReader.ts`, which validates the Design ID, manufacturing
  plan version, selected physical star count, all three exact artwork/spec/guide
  file variants, and the original preview. Actual frozen files are downloadable
  individually; any *regenerated* reference is separately labeled. The original
  customer image stays private. Existing legacy packets with wrong Design IDs
  cannot masquerade as validated frozen packets.
- **Production ID alignment repair:** `customerOrder.ts` now supplies the
  server-issued SK Design ID to the frozen manufacturing-job-plan.json, rather
  than retaining the client-side `design-placeholder` draft ID. New frozen
  packets match their full order manifests and private asset keys.
- **14-phase rehearsal:** `src/rehearsalPhases.json` defines **103 detailed
  test-only checks**, spanning preflight, files, procurement, print/panel,
  apertures, StarPods, harness, electronics, current-limited power-up,
  dark-room optical, burn-in, final assembly, QA and packaging. These records
  are stored individually and independently under the matching test Design ID
  by the same owner-authorized Vercel API namespace. Reloads resume progress.
  The legacy 23-step paid-job checklist remains unchanged and is not used as
  the simulation's sole evidence log.
- **Per-job parts:** Exact N-dependent maker parts from the saved/frozen plan
  are snapshotted on simulation creation. Each part independently tracks
  Needed, In stock, Need to buy, Ordered, Shipped, Delivered, Inspected,
  Allocated, Ready or Not applicable (with justification), plus physical
  validation level and written notes. **M3 on-hand stock is global**, never
  automatically reserved by a test job. Missing stock and uncertain quantities
  stay unknown/TO MEASURE, never invented.
- **Supplier confidence vs build testing:** Manufacturer Direct,
  Reputable Distributor / Specialty Vendor, Marketplace Seller Verification,
  etc. are shown separately from Research Candidate/Datasheet/Bench/Fit/
  Optical/Electrical/Thermal testing. Research links include Adafruit product
  1429 (TLC5947), 5648 (MOSFET); Curbell genuine 3 mm SINTRA;
  Lumimax LED3FWAW on DigiKey Marketplace; Drytac MultiTac documentation.
  None is automatically build-approved. PSU and fuse remain **not selected**
  until current/rating measurements. Never laser SINTRA/PVC.
- **Print lab selection:** Owner chooses exact, 1/8-in or 1/4-in bleed only
  after recording supplier/format acceptance and proof; each original variant
  includes a human-readable summary and original JSON guide. The 1/4-in
  master is not automatically the print lab file.
- **Engineering HOLD:** The test work order explains Pico W → TLC5947
  individual constant-current sink channels, conceptual common-anode and
  indexed cathode routing, and that old `firmware/pico2w/main.py` remains
  WS2812 bench firmware — not approved for direct LED driver hardware.
  No fabricated GPIO pin mapping, PSU/fuse ratings, wiring gauges or
  safe-current claim. First power-up is current-limited, requires a reviewed
  schematic and recorded channel, current and thermal checks.
- **Evidence and closeout:** The owner can privately record each job's
  selected print-lab file, physical part status, pin-map/PSU reference,
  current, burn-in start/end/duration, temperatures, optical results,
  QA/rework notes and nonpublic inspection-photo references. TEST build
  completion requires all 14 phases, required parts ready, proof approval,
  physical star geometry validation, and key measured/evidence fields; this
  records only owner-reported **TEST_BUILD_COMPLETE**, never a paid order,
  safety certification, shipping label or supplier purchase.
- **Existing saved designs:** Owner can also paste their PRIVATE reopening
  link in the admin Test Orders section. A bare SK ID is intentionally not
  sufficient for existing Azure private photo access. A non-frozen saved
  design must first be opened and prepared in the customer builder.
- **Old BOM deprecation:** `docs/manufacturing/candidate-bom.json` now explicitly
  states it is LEGACY WS2812/Pico WH material and is prohibited as current
  production sourcing truth. Real order-specific frozen maker files
  take precedence.
- **Open validation:** The first real physical prototype, print-to-drill
  registration, calibrated StarPod bore, verified firmware pin map and
  reviewed schematic, power/current/temperature burn-in and supplier SKU
  selection remain physical engineering holds. Never claim that checking
  all UI boxes legally or electrically certifies the product.

Acceptance sequence: customer builder SK saved + private frozen packet → click
Simulate Etsy Purchase OR use private reopening link in owner admin → see
real order preview/variants/star plan → choose approved lab file → log each
part's fulfillment and validation → resume 103-check log after refresh →
record electrical/optical burn-in and QA evidence → owner marks internal
TEST BUILD COMPLETE (no Etsy action) → optionally delete the simulation
without destroying the saved design or original immutable ZIP.

## November 23, 2026 — fix stuck "Simulate Etsy Purchase" and false payment mismatch

**Owner symptom:** Click `Simulate Etsy Purchase` in Chapter 05, the progress animation does not finish. A newly saved `SK-...` ID appears under saved designs in the owner dashboard but says
`Saved · no matched payment`; the simulation might not have been registered
yet. That message is generated by the **actual Etsy paid-order lookup**, not by
a test-payment verification. It must never be treated as proof that an internal
simulation paid Etsy.

**Root contributors confirmed in code:** (a) the previous simulator called
`buildOrderPacket()` unconditionally, even if the exact design was already
frozen; this re-ran all high-resolution print variants and a huge maker ZIP;
(b) `orderManifest.ts`'s CRC32 checksum ran 8 shift/XOR iterations per file
byte, including all full-resolution prints; (c) full-resolution generation,
archive upload, and remote server requests lacked duration bounds;
(d) owner key was not verified until after heavyweight rendering; and
(e) the saved designs table used "no matched payment" for both unpurchased
drafts **and correctly simulated, unpaid tests**.

**Changes:** `orderManifest.ts` now uses a standard 256-entry lookup-table
CRC32 for byte-for-byte-equivalent ZIP checksums (verified golden vector
`123456789` → `CBF43926`). The simulator checks owner credentials **first**
through a new authenticated GET `/api/production/simulate?view=auth`.
If the exact design has already been saved and `getFrozenStatus()` reports
archived, it **directly registers the test without rebuilding** the expensive
print/ZIP. New/unfrozen designs still save, render and freeze. Named 30–90s
deadlines clear UI states and surface actionable errors rather than leaving
a spinner indefinitely. Registration has a 30s limit; an owner-authenticated
GET by Design ID reconciles a timed-out POST that may nonetheless have saved.
All paths use the same owner key and saved private design access key, never
write fake Etsy receipts or payment flags, and never permit unfrozen designs
to become ready to manufacture. Progress copy now distinguishes owner auth,
file preparation and test registration.

Production Studio's "Recently saved designs" now joins private test order
IDs with draft IDs for **TEST ORDER · No Etsy payment required**, including
an **Open simulated work order** action. Not-yet-simulated drafts say
**Saved draft · Test purchase not yet registered**, not misleading "payment
mismatch". Actual Etsy verified paid status and real paid metrics remain
unchanged; the `Your simulated purchases` table remains a separate truthful
test-only register. Direct `?testDesign=SK-...` links scroll to the test
work order after admin sign-in.

**Still must verify with owner key:** A new live Chapter 05 design should
save+freeze, register internal test once and open it in Production Studio;
same Design ID should show as TEST ORDER in both test and saved design
tables, no real Etsy payment. Re-clicking a previously frozen design should
skip print rendering and register quickly. Real customer checkout still
requires an Etsy-paid receipt for actual fulfillment. If a frozen upload
fails or times out, it should show a useful retry message; saved Design ID
is not lost. Do not assume completion from a mere saved-design row.

## November 23, 2026 — Production Studio navigation redesign

Owner confirmed the exact saved-design simulation, source files and order contents
now correspond to what they designed. Requested **presentation-only simplification**:
a clear top nav, a compact Orders home page with clickable rectangular cards, separate
parts and checklist modules, and a spreadsheet-like supplier directory for
Amazon shopping with names, website links, last-entered prices and notes.

- New authenticated top-level tabs: **Orders** (default), **Shopping & suppliers**
  and **Operations**. Existing private admin key and authoritative Etsy/simulated
  order backends remain unchanged. The default view does NOT mount the large
  Amazon queue, inventory, procurement or old sample components.
- Orders tab combines privately saved owner simulations (clearly **TEST · UNPAID**)
  and imported real Etsy receipts (status computed from actual Etsy fields)
  into searchable, filterable rectangular cards sorted by creation date. A card
  identifies its Design ID or receipt, created/purchased date, frame and status.
  Receipt cards must not be called paid without real payment confirmation.
  Unmatched/unpaid receipts show an explicit manufacturing hold; only genuinely
  verified paid and matched single-item Etsy jobs expose owner-only work modules.
- Selecting an order opens three action cards **Parts & supplies**, **Build
  checklist**, and **Artwork & files**. Each opens its own accessible Escape-
  dismissable modal. The existing `OwnerProductionFiles`,
  `OwnerManufacturingPlan` and `RehearsalWorkbench` have optional module
  props, so the content is **scoped and filtered**, not duplicated or switched
  to new storage. Files still load the exact private frozen ZIP. Test parts
  continue saving in the isolated owner-only simulation records. The 14-phase/
  103-step rehearsal checklist, QA/photo evidence and physical HOLD criteria are
  unchanged and remain server-persisted. Paid Etsy checklist still uses its
  own paid-job-scoped endpoints.
- Shopping & suppliers tab: new `SupplierCatalogTable.tsx` and CSS render
  a searchable sheet-style table containing user-entered M3 catalog rows and
  separately flagged researched supplier candidates. Columns: product/SKU,
  supplier, website, price/unit, on hand, source type, notes/validation. M3
  unit price is labeled **RECORDED NOT LIVE**. Research rows say price not
  verified; clicking source opens actual vendor page to check its *current*
  price and stock. No Amazon Business price API exists yet; do not invent live
  quotes or classify stock as allocated. Catalog editing remains available in
  Operations. Existing `ManualAmazonPurchasingPanel` lives in an expandable
  Shopping section for confirmed paid-job shortages and manual receipt logging.
- Operations tab retains old genuine Etsy sync/register/CSV, purchased Design
  IDs, saved drafts, the existing M3 Materials catalog/stock/allocations,
  procurement/ASIN mapping, and the previous fixed sample (now folded away).
  Real Etsy sales totals and any purchasing/receiving actions are not touched.
  The old demo stays labeled fictional, not paid or a production record.
- Styling: quiet dark/studio palette, clear 3-column desktop cards and responsive
  1-column mobile cards; sticky tab nav, compact module launchers, wide readable
  modal content, keyboard Escape/backdrop to dismiss, visible focus outlines,
  search and filter states, and no bulky data blocks until their tab/module is
  deliberately opened.
- Key preservation: a direct owner link `?testDesign=SK-...` still opens its
  corresponding test card/workspace; deleting a test still requires confirmation
  and only clears that test's isolated server records. No new backend routes
  or data migrations. User-entered supplier notes remain from existing M3
  metadata, not new unsecured browser state. No actual live supplier pricing
  integration is claimed.
- Test owner acceptance: sign in, see Orders by default, open the same test
  Design ID, open Parts and save a status, open Checklist and tick one step,
  close and reopen to verify server persistence, open Files and verify frozen
  art and star map; confirm real paid receipt is distinct from TEST; browse
  Shopping sheet rows/links and marked non-live prices; expand Amazon queue;
  open Operations and verify existing M3 and Etsy registers still usable.

### Navigation compatibility detail

The manual Amazon buying queue is loaded only after its accordion is opened
in the Shopping tab; closing it unmounts its two-minute poller. Its existing
`Go to M3 recipes and job BOMs` action now switches to Operations and focuses
the real Materials panel. Links to the combined Amazon queue from the legacy
Etsy-item detail now switch tabs and expand the queue rather than pointing to
a hidden anchor. Modal navigation includes Escape, keyboard Tab focus
containment and focus restoration to its trigger; closing or switching tabs
does not write any order state. The card's **Ordered** field uses the actual
Etsy `created_at_etsy` field, never the potentially later `last_synced_at`
timestamp. Its receipt total is separately labeled and not computed for
internal unpaid tests.

## 2026-11-23 — Simplification follow-up: readable light Studio and true to-do modules

The owner inspected the previous three-tab redesign and reported that it remained
too crowded, included excessive small captions and paragraphs, and visually
resembled the dark customer night-sky experience. The correct customer design
files and simulation functionality were already verified by the owner; **this
turn fixes presentation, not the astronomy or frozen manufacturing data**.

- Admin-only `StudioLight.css` switches the authenticated Production Studio
  to a **light off-white, white-card, dark-ink, teal-action** theme with readable
  base font, substantial click targets, and fewer visual layers. No customer
  Chapter 05 style or astronomy logic is changed.
- Compact Orders cards no longer show redundant descriptions. Opening an order
  shows three simple cards: **Parts & supplies**, **Build checklist** and
  **Artwork & files**. Each opens one white modal with no explanatory paragraph
  stack. Existing manager/Operations tab remains available separately.
- New `SimpleStudioModules.tsx/.css` implements these actual modules:
  - **Parts:** One per-design list; each row has only a checkbox, quantity+
    component name and supplier link (or `No link`). Simulated parts read
    their authoritative per-design candidate-BOM snapshot from authenticated
    `GET /api/production/simulate?designId=...&view=parts`. Checked items
    persist as `ready` in existing private test-only `view=work` records,
    preserving prior validation/notes. Unchecking returns to `needed`. This
    is the owner's own checkbox assertion of physical readiness, NOT a supplier
    purchase, production approval or M3 stock allocation. Make-only tasks
    remain on the Build checklist rather than shopping list.
  - **Real paid job parts:** new server-only
    `/api/production/parts?receiptId=...&transactionId=...` provides separate
    authenticated private Blob checkmarks under
    `production/paid-parts/<receipt>/<transaction>/<designId>`. The server
    uses `authorizePaidJob` for GET and its stricter `forWrite` eligibility
    on POST, so a held/canceled/finished job cannot be silently edited.
    This lightweight checklist is separate from true M3 stock/allocations.
    The roster comes exclusively from the frozen saved-design maker packet
    via the existing authenticated paid-job `/api/production/archive`.
  - **Build:** A single checklist phase at a time with large rows, a basic
    progress meter, and Previous/Next phase controls. Simulated owner tests
    still write the existing individual 103 phase step records via
    `/api/production/simulate?view=work`. Paid jobs still write their known
    23 paid-job step IDs through the existing `/api/production/checklist`.
    The current Test Build Complete safety/QA server gates are NOT modified.
    Advanced electrical and burn-in records remain available under the
    original Operations interface if needed. Checking boxes is an owner
    assertion, not a legal/electrical approval.
  - **Files:** Original frozen customer preview and a clean download list
    (star-map CSV, 11×14/⅛/¼ print PNGs, draft drilling guide,
    original photo and immutable packet). Same original private ZIP
    `readFrozenMakerPacket` validation, no regenerated false originals.
    Other technical packet files remain available behind one disclosure.
- Supplier table now has **four wide readable columns only**: Item,
  Supplier link, Saved price and Notes. Price remains a recorded M3 amount
  (or em dash for unverified research), NEVER a fabricated live Amazon quote.
- Existing private owner credentials never enter URLs or local persistence.
  The real Etsy receipt verification, test record deletion, supplier purchasing
  and paid-order revenue are unchanged. All overlays/actions remain keyboard
  accessible and responsive.
- Owner acceptance: authenticate, verify light UI and large text, open exact
  test Design ID, tick a physical part only if acquired, close/reopen to
  confirm saved status, tick an actual build step and verify persistence,
  download frozen source artwork, then inspect the clear four-column supplier
  sheet. Verify genuine paid order is labeled separately; unverified
  orders are not eligible for paid manufacturing modules.
