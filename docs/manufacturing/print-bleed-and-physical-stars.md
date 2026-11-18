# M4/M5 Manufacturing Revision — Print bleed and physical star subset

**Development/proof-only; not approval for customer fulfillment, electrical safety or CNC/laser operations.**

## Data flow and compatibility

- Skyfield/DE440s generates the usual astronomical positions in the existing azimuth-altitude equirectangular artboard.
- `services/design-engine/physical_star_selection.py` selects a deterministic, magnitude-aware, evenly distributed **physicalStars** subset from all eligible projected stars using bright anchors, 4.5 mm default minimum spacing and edge exclusion. Star coordinates are NEVER moved.
- The existing **stars** array remains a backwards-compatible **displayStars** alias (normally about 96 digital stars) so old interactive previews and saved design v1.5 readers continue working.
- New optional design fields: `displayStars`, `physicalStars` (with HIP, magnitude, xMm/yMm, holeSizeMm, 0..N-1 ledIndex, selectionReason, selectionPriority), `physicalSelection` (algorithm/version, maximum, eligible total, actual count N, spacing, 24-channel *driver estimate*).
- **Current product development cap is 24 physical stars in the chosen view** (configurable, not permanently coupled to the TLC5947's 24 output channels). Default `MAX_PHYSICAL_STARS=24` in design engine and M4; UI `DEFAULT_MAX_PHYSICAL_STARS=24` in one module. `PHYSICAL_STAR_MIN_SEPARATION_MM=4.5` is adjustable. After electrical/mechanical proof, raise all relevant config limits deliberately; driver planning is `ceil(N / 24)`. Old WS2812/Pico 2 W demonstration firmware remains limited to 30 for an unverified bench setup and is not a production driver.
- For a new saved design, M4 uses physicalStars *without changing or renumbering* the selection and outputs N positions in `led_map.json` and M5. With `--leds 12`, M4 can intentionally output a lower bench subset, capped by the configured physical maximum. Legacy v1.5 designs with stars but NO physicalStars remain readable; M4 emits `legacy_reselected_HOLD` and requires regenerating the sky for authoritative selections. Do not silently overwrite an older paid design.
- Developer overlay at `https://starkeepsake.vercel.app/?physicalInspector=1`: on the preview step toggle “Show physical LED stars only” and inspect N/eligible/max, HIP, magnitude, canonical X/Y and selection reason. No privileged data is exposed; the inspector is opt-in and not shown by default.

## Print document and lab proof

A new *manufacturing* raster `print-artwork-with-bleed.png` is created separately from the existing illustrative `order-sheet.png`. The maker ZIP also contains `print-spec.json` and a **separate**, never-to-be-printed-over-art `print-trim-safe-guide.svg`. A 300-DPI PNG pHYs chunk is embedded so file metadata agrees with the intended pixel density.

| Property | Nominal 11×14 default |
|---|---|
| Final visible trim | 11 × 14 in = 279.4 × 355.6 mm |
| Bleed per side | 0.125 in, configurable in `DEFAULT_PRINT_SETTINGS` |
| Document size (print at 100% / no fit-to-page) | 11.25 × 14.25 in |
| Full pixel size at 300 DPI | 3375 × 4275 px |
| Trim within document | x/y 37.5 px; w 3300 px; h 4200 px |
| Safe inset inside trim | 0.25 in = 75 px |
| Safe rectangular region | x/y 112.5 px; w 3150 px; h 4050 px |

The whole print document is opaque artwork, not a white border; the trim stays the customer's nominal 11×14 area and the bleed is extended colored edge pixels from the trim art. Trim/safe guides exist ONLY in a separate proof overlay, not the submitted print PNG. Configurable `DEFAULT_PRINT_SETTINGS` in `apps/web/src/manufacturingPrint.ts` controls bleed, safe inset, and DPI. The source image can be lower quality than the 300-DPI final raster; resampling does not create missing detail.

**Lab and mechanical hold:** Do not send a 3375×4275 PNG to a lab that auto-crops/reformats to 11×14; obtain explicit support for 11.25×14.25 image submissions (or their equivalent PDF bleed/trim workflow). Confirm the SINTRA panel, rabbet and substrate dimensions and make a physical alignment proof. Some print houses require 0.25-inch bleed on mounted work, so verify before changing the config. Critical faces/text and image crop need human inspection even when caption is automatically constrained inside the safe area.

**Astronomy/photo alignment caveat:** The current customer-facing immersive preview and order sheet use observer-camera projection, while canonical M4 positions remain equirectangular. This update deliberately DOES NOT move catalogue coordinates to make them match. Cross-check the printed star field against the physical registration and reconcile projection on actual hardware **before drilling, delivering, or approving a customer job**. `PROOF_REQUIRED` is mandatory in the print/mfg packet. The export is a print candidate, not validated final fabrication instructions.

## Deployment

One cohesive release touches design engine, ASP.NET typed response, shared TS types, customer packet, development inspector and M4/M5 tests. Production builds are triggered only once by the single merged commit; no database migration or Etsy supplier purchase is authorized. Repeat tests in `services/design-engine/tests`, `tools/prototype/tests`, and web `npm run test:print` / build, and confirm both Azure container apps reach the same commit SHA after release.

## 2026-11-17 — View-specific automatic and manual LED selection

**Current product development setting:** `DEFAULT_MAX_PHYSICAL_STARS = 24` in
`apps/web/src/physicalStarSelection.ts`; design-engine and offline M4
`MAX_PHYSICAL_STARS` environment defaults also changed to 24.
This is a configurable product policy, **not** a hardware channel-count rule.
The selection algorithm independently accepts other tested maximums up to 128;
a future deliberate production config change must keep web + engine + M4 consistent.

**What counts as in view:** The user's final azimuth/altitude camera perspective,
FOV, upper-sky split, photograph aspect ratio and visible open-sky mask. The
website considers only stars which fall within BOTH the customer sky viewport
and the actual printable 11×14 view, with an edge exclusion for drilling.
The digital sky still renders many correct catalog stars. The displayed
"stars in view" number can exceed the print-safe LED candidate count.

**Automatic:** When there are 24 or fewer printable, safely spaced stars, each
gets a physical LED. When there are more, brightest anchors are kept first,
then a deterministic brightness-and-spatial-coverage fill excludes excess
faint/clustered candidates. Close stars cannot become two overlapping drilled
holes, even when there are fewer than 24. Show the customer such exclusions.

**Manual:** Chapter 04 now has a "Choose illuminated stars" mode: tap a plotted
star or toggle its HIP/magnitude row. A manual set records the exact chosen
HIP ids (which may be under 24); no unwanted automatic refills. Reject
overlapping LEDs and selection above the configured cap with an explanation.
Reset restores automatic selection. Manual selections persist as the optional
`physicalStarOverrides` field in DesignSpec v1.5 and its saved design JSON;
no database migration. Changing the viewing angle can hide some manual choices;
the inspector shows the current N and user should review before saving.

**Coordinates:** Canonical astronomical xMm/yMm and altitude/azimuth are
untouched. Final physicalStar records also include
`printXMm`/`printYMm` computed from the *same observer camera projection*
used by the manufacturing print renderer. M4 registration and LED maps use these
print-space coordinates when present, retaining original canonical values
separately as `catalogueXMm`/`catalogueYMm` for traceability.
Selection remains a provisional physical plan: customer photos may lack a
calibrated camera/lens and lab trimming/mounting requires measured proof.

Older saved designs remain valid. Restored prepared PNG cutouts are sampled
for alpha to avoid selecting LEDs hidden behind preserved foreground.
Legacy packets without new print coords remain explicitly proof/HOLD.

**Tests:** `npm run test:physical-stars` covers 12/24 auto inclusion, >24
brightness/spread determinism, manual under-cap edits, spacing and cap;
M4 offline tests cover final print coordinates and canonical retention.
