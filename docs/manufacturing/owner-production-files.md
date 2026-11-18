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
