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
