# Sky / photo opening — full-frame configurator (DesignSpec v1.3)

This release replaces the clustered circular sky and small centered photograph
with a rectangular night sky above an almost full-width customer photograph.

## Nominal frame-opening presets

| Preset | Artwork opening (mm) | Inner margin (mm) |
| --- | ---: | ---: |
| 8 × 10 in | 203.2 × 254 | 5 |
| 11 × 14 in | 279.4 × 355.6 | 6 |
| 16 × 20 in | 406.4 × 508 | 8 |

**Supplier validation pending.** These are common nominal print sizes, **not**
confirmed frame external dimensions, mat openings, rabbets or mounting
tolerances. Before taking orders, reconcile actual supplier SKUs with the
artwork opening and manufacturing output.

All measurements are in millimeters, origin at the upper-left.
Each selected opening uses ~47% of its height for the **sky up to the
horizon**, ~40% for the customer's **photograph**, and the remainder for
names/date/place. The sky and photo both use the opening's full inner width
(with only a small margin). Rectangles are authoritative through
`framePresetId`, `physicalArtwork` and `regions`. If the preset changes,
recalculate the astronomy; never stretch already generated stars.

## Astronomical projection

The Python engine uses the genuine Hipparcos catalog and Skyfield ephemeris.
To show the actual sky as a broad rectangular panorama, DesignSpec v1.3 uses
an **altitude-azimuth equirectangular projection**, not the old circular
azimuthal-equidistant projection. North is center; east is right; west is
left; zenith is the top line; the visible horizon is the bottom line.
Azimuth 180° wraps at the left/right seam. This is a *flat all-sky map*
of real star coordinates, **not** a perspective photograph of the horizon.
No invented decorative stars are added.

## Photo cropping / privacy

The configurator defaults to `photo.fitMode = 'contain'`: the **complete**
photo is shown, letterboxed white if its aspect ratio differs from the photo
panel. A customer can select `cover` to fill the photo region, then drag
and zoom the crop. `photo.crop` is `{x, y, width, height}` normalized to
the EXIF-oriented original image; values are bounded to the [0,1] domain.
The server verifies the crop rectangle and target ratio and applies it before
engraving tones. A crop edit regenerates the downloadable temporary PNG
through public ASP.NET API → Python engine, with cancel/debounce to avoid
stale previews. The processing resolution is **6 pixels/mm** (visual
preview); it is **not** a calibrated laser DPI.

No database/order/blob persistence is implemented. Uploads may be temporarily
buffered by HTTP framework handlers. Nothing here constitutes a tested
manufacturer's product or proof of laser engraving quality.
