# Paid Etsy order â€” private owner manufacturing file retrieval
Status: implemented in web/API; physical manufacturing proof still REQUIRED.

1. Customer saves immutable design (SK-16HEX) with original and optional prepared
   foreground in private Supabase storage. Etsy checkout includes Design ID.
2. M2 imports the Etsy receipt, matches one valid design for a paid unrefunded
   transaction and creates a production job.
3. /admin/production â†’ Etsy order â†’ Prepare production files.
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
action runs browser-only generation of synthetic 3600Ã—2700 photo, Chicago
2024-07-04 21:00 known observer moment, live astronomy API (separately flagged
if unreachable), real¶»§q«^