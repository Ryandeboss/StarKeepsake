# Paid Etsy order — private owner manufacturing file retrieval
Status: implemented in web/API; physical manufacturing proof still REQUIRED.

1. Customer saves immutable design (SK-16HEX) with original and optional prepared
   foreground in private Supabase storage. Etsy checkout includes Design ID.
2. M2 imports the Etsy receipt, matches one valid design for a paid unrefunded
   transaction and creates a production job.
3. /admin/production → Etsy order → Prepare production files.
4. Every private GET on /api/admin/production/jobs/{receipt}/{transaction}/design
   or /assets/{original|foreground} verifies the owner key, authorized Etsy shop,
   paid receipt, matched one-unit item and matching job, before private read.
   Saved-only, refunded, canceled or mismatched orders receive no photo.
5. Browser creates 3 300-DPI files from identical trim composition; owner can
   download each PNG/spec/proof guide or whole maker ZIP. Files are ephemeral.
   No public customer photo, database key or private reopening key is exposed.
6. Print-shop bleed spec, photo effective PPI, colors, physical drilling and
   prototype assembly must be verified by owner. No purchase action occurs.


## Guided trial order lab (2026-11-18)

Launch `https://starkeepsake.vercel.app/trial-order`. A single **Run automated trial**
action runs browser-only generation of synthetic 3600×2700 photo, Chicago
2024-07-04 21:00 known observer moment, live astronomy API (separately flagged
if unreachable), real visible-LED subset selection, deterministic 12 / 40 /
manual / restore checks, three full-resolution manufacturing PNGs and PNG
dimension inspection, ZIP/manifest checks, and an **anonymous** owner API
401 test (never submits a real admin key). Export result JSON and a
**SYNTHETIC** manufacturing ZIP; a simulated receipt is displayed locally
and never inserted into Etsy or Supabase.

The lab also provides `/?trial=1`: click **Use prepared trial photo and
example date/place** to seed the REAL interactive customer workshop with
no typing. Follow existing Chapter 02–05 steps and explicitly save a test
design to check the existing private design save/reopen flow. Saving is
an actual SAVED_UNPAID record, so only do it intentionally.

Manual steps: inspect original/sky; verify manual LED picker and restore;
save + reopen; inspect Etsy listing personalization **without paying**;
open private Production Studio and confirm simulated receipt absent;
download and inspect print formats. Real owner file retrieval, webhook/paid
sync and payment can only be certified with an owner-authorized **actual paid
Etsy test order**; synthetic lab never impersonates paid Etsy or permits
fabrication/purchases. Note that effective PPI estimate in lab is informational
only; site-wide customer print quality gating is not complete. Supplier
print proof, exact hole registration, print color and hardware QA remain HOLD.


## 2026-11-18 — Source-photo professional print preflight

The retail manufacturing product is **fixed at an 11×14-inch physical trim**.
New uploaded photo aspect ratios are preserved as source aspect/fit choices,
NOT permitted to change the product's physical artwork dimensions. Saved legacy
designs with different artboard geometry are NOT silently remapped: preflight
marks them **owner review required**; verify old star coordinates and physical
mockup before manufacturing or ask the customer to re-save a corrected design.

`apps/web/src/photoPrintQuality.ts` computes effective **source** PPI from the
printed-photo region, the selected sky split, and the source-pixel window
for *fit*, *cover/crop* and *within-photo* composition, independent of the
300-DPI PNG export document. Baseline initial tiers are >=250 excellent,
200–249 good, 150–199 caution, <150 owner-review hold; exact PPI displayed.
Warnings also cover cropping away >50% of source, anisotropic stretching from
the current within-photo compositor, extreme exposure, and abnormally flat
details (nonbinding sampled blur heuristic). No external AI, no automatic
upscaling or loss of customer originals. Subtle/intentional blur and night
photos can trigger false positives, so heuristics never justify auto-rejection.

Chapter 05 shows a labeled photo preflight, detailed warning, and original
pixel-detail inspection. Low-PPI/distorted/legacy geometry requires the buyer
to explicitly acknowledge the owner approval hold before preparing the Etsy
packet; they can still save a design. The **print approval itself is NOT
automated** by the buyer acknowledgement. The same preflight is recomputed
on the original saved photo during owner maker-packet generation, displayed in
the owner job details, and written to both `order.json` and a separate
`photo-quality-report.json` in the ZIP. This keeps job quality tied to actual
artwork bytes without a Supabase DB migration. This is not a printer or color
management certification; print-lab proof/ICC validation is still required.
The Trial Order Lab now tests high, low and cropped source tiers as well as
the quality record carried into the same synthetic maker packet.

Important next steps: visually compare online Chapter 05 preview against
actual 11×14 raster across photo ratios, inspect saved legacy order geometry,
verify the physical print/mount and drill registration, and add owner approval
state to the private job lifecycle (currently a visible hold, not an enforced
server-side production transition).


## 2026-11-18 — Per-order owner engineering review (prototype CANDIDATE)

Audit against owner 710-line builder/Etsy/manufacturing specification:
the currently live M3 Supabase project had **zero** materials catalog rows,
recipes, plans, real Etsy paid receipts or production jobs. Its recipes are
fixed per-frame quantities rather than selected-N formulas, and Etsy item
records lack verified frame-finish variation values. It is **not** accurate
to claim that a paid job automatically has verified purchasable parts.

The `manufacturingJobPlan.ts` versioned, deterministic client engineering
preview now computes for every **verified paid matched** saved design:
- actual physicalStars `N` (never digital stars or a fixed 24),
  `ceil(N / 24)` TLC5947 boards, `ceil(N / 12)` star connector groups,
  N LED3FWAW LEDs, N StarPods and N numbered harness branches;
- separate Buy for Order / Pack Stock / Bulk Stock / Make per Order groups;
  full proto-electronics bill, packaging and 23 QA/assembly steps;
- product finish, 11x14 trim/orientation, saved sky moment and HIP/magnitude/
  frozen print coordinates, manual selection state and star indices 0..N-1;
- relevant uncalibrated component quantities as **TO MEASURE** instead of
  inventing lengths, supplier SKUs, shipping or prices;
- optional read-only M3 global inventory matching by explicit stable SKU hints
  (never fuzzy links), and provisional shortfall clearly not a reservation;
- **PRODUCTION HOLD** for hardware, drill/template registration,
  electrical certification, missing stars and wrong legacy trim.
- 1:1 **DRAFT** front-face drilling SVG and star CSV only if saved indexed
  coordinate geometry passes numerical / spacing validation. Template must
  be physically checked with printed 100%-size ruler and artwork alignment.
- Maker ZIP (created in browser before Etsy) now adds engineering JSON, star
  coordinate CSV, candidate parts CSV, optional draft SVG and draft checklist.
  This is **not** a server-stored immutable final print packet.

The admin job opens the owner planning preview automatically after authenticated
paid/matched metadata fetch; full private photo and the print ZIP still require
owner's deliberate Prepare action. Checklist can be checked in the current
browser and exported as JSON, **NOT** saved on the server or synchronized
between devices. Real permanent audit workflow/owner authorization is pending.
Current M3 fixed BOM is explicitly labeled separate and potentially wrong
for selected-N physical electronics. Do NOT purchase from it without reconciliation.

For developer flexibility the default maximum remains 24, with explicit
optional 48/72 LED capacity in Chapter 05; these larger designs remain
physical PROTOTYPE HOLD for firmware/power/multi-board testing.

**Still NOT launch ready**: server-frozen immutable final print/cutout/artifacts,
paid Etsy variation mismatch verification, approved SKU/suppliers/pricing and
catalog, M3 design-specific durable BOM snapshots, durable step/QA approval,
physical 1:1 drill-to-print registration, power/burn-in safety and actual paid
Etsy end-to-end acceptance. No live Etsy payment, supplier order or inventory
change occurs in these software changes.

## Research-source suppliers (Nov 18, 2026)

The owner dashboard now shows specific researched distributor/manufacturer catalog
links for the LED3FWAW LED, Adafruit TLC5947, Pico W, 11x14 shadowbox category,
Nations Photo Lab photo print, black expanded-PVC, 3M 467MP transfer tape,
PETG and hookup wire. All carry LISTED_NOT_BUILD_VALIDATED. Suppliers, exact
fit, lead times, compatible ratings, actual availability, price, purchase
quantities and physical prototype tests are NOT yet approved. The M3 catalog
is not modified or auto-seeded, and none of these links initiates a purchase.

The prior selected-N formulas remain live: physicalStars.length is N;
N LED3FWAW, N StarPods, ceil(N/24) TLC5947 boards, ceil(N/12) connector
groups. Default capacity 24 with 48/72 development modes still requires
multi-board and power/prototype QA.

A private Vercel Blob store has been provisioned for future immutable packets
and durable checklist records, but a Vercel function release was rolled back
after a sandbox-to-GitHub source transfer truncated files. This documented
safe supplier update is live; the Blob-backed customer archive and cross-device
checklist endpoints are NOT deployed or tested. Existing manual maker ZIP
and browser-local checklist behavior remains until a fully verified release.


## November 18, 2026 — Private Vercel manufacturing storage and permanent checklist

A **private Vercel Blob store** was connected to the StarKeepsake Vite
project. New customer checkout makes the exact locally rendered maker ZIP
available for short-lived, direct private upload only after the saved
SK Design ID and private access key pass the existing Azure saved-design
authorization endpoint. The serverless endpoint enforces no overwrite,
a versioned pathname and a size/content-type limit. The buyer may not
proceed to Etsy until the private archive reports it exists. All three
300-DPI print formats, saved physical star map, N-dependent candidate BOM,
quality report and artwork source are included in the frozen ZIP.

Paid Etsy orders in the owner Production Studio can download the *original
frozen* maker ZIP only after the Vercel Function revalidates the paid and
matched receipt via the existing Azure server, including refund/cancel
protection. The existing owner regeneration action is available as an
explicit **reference copy**, not the original frozen customer archive.
A pre-rollout legacy order without a frozen ZIP shows a visible warning.

Each of the 23 assembly/QA checklist steps is now independently persisted
as a private Vercel Blob JSON object, keyed by receipt, transaction and
Design ID. Every read/writer requires Azure owner authentication and a
matched paid job; checklist writes also require a job in awaiting_review or
in_progress status. The UI disables checkboxes if storage is unavailable
rather than silently falling back to browser-only records. The checklist
does not automatically approve physical safety, a print run, or shipment.
Current updates store latest per-step state, **not a full append-only audit**.

Supplier links are researched manufacturer/distributor pages and are
deliberately labeled compatibility holds, not verified stock, quotes,
electrical certification, order authorization, or parts purchased.

**Still required before announcing a launch:** verify positive frozen
client upload and exact ZIP retrieval through live Vercel functions; perform
a deliberate real paid Etsy order to validate private owner download and
cross-device checklist; verify purchased frame finish variation, lab bleed
selection and physical 1:1 star drilling registration; approve actual
supplier SKU, wiring, power and thermal testing. The initial server freeze
authenticates the Design ID but does not cryptographically prove the client
ZIP pixel bytes equal server-saved original/photo fields.
