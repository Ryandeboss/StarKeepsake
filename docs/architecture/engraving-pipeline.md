# M6 — Engraving preview pipeline

This milestone adds a server-produced, grayscale visual approximation of the
photographic engraving. This is **not** a laser-ready toolpath, calibrated
material setting, or proof of manufacturability. It does not segment or remove
a photo background; the first iteration center-crops to the reserved area.

- Canonical photo region: **210 × 125 mm**; output **2100 × 1250 pixels**
  (10 px/mm, ~254 PPI). The Python engine owns this raster transformation.
- Accepted inputs: JPEG, PNG, WebP; maximum upload **10 MiB**, maximum decoded
  dimensions **20 megapixels**, minimum edge **64 px**.
- EXIF rotation corrected; transparency flattened to white; center crop;
  grayscale, autocontrast and subtle sharpening; output PNG without EXIF.
- Identical input bytes deterministically produce the same output for a
  given deployment and image-processing library version.
- No user uploads or outputs are written to local disk, database, or blob.
  The browser preview is temporary and lost on refresh.
- `POST /engraving/preview` on Python receives multipart field `image`.
  The public browser will use `POST /api/engraving/preview` on ASP.NET,
  which forwards the image to Python. Never direct frontend uploads to Python.
- The existing photo crop entry in DesignSpec is **not** yet authoritative
  for this preview's implicit center crop. A later milestone must make the
  crop selection explicit and canonical before manufacturing export.
- Laser tests on the intended real substrate, power, speed, kerf/dot profile,
  and raster resolution are required before producing manufacturable output.

For privacy: do not log upload contents, filenames, or image contents; avoid
caches and persistence; enforce upload size at both ingress and processing.
