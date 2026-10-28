# Architecture

## Canonical physical design model

StarKeepsake uses `DesignSpec v1` as the authoritative model for the physical artwork. The contract lives in [`contracts/design-spec`](../../contracts/design-spec) and is shared with the frontend through the TypeScript definitions in `design-spec.ts`.

### Artwork coordinate system

The physical canvas is an 11 × 14 inch portrait artwork:

| Property | Value |
| --- | ---: |
| Width | 279.4 mm |
| Height | 355.6 mm |
| Origin | Top-left `(0, 0)` |
| X axis | Increases to the right |
| Y axis | Increases downward |

The frontend converts every physical position using one scale factor derived from the rendered canvas width:

```text
displayPixels = physicalMillimeters × (displayCanvasWidthPixels / 279.4)
```

The canvas keeps the same `279.4 / 355.6` aspect ratio while resizing, so logical coordinates remain unchanged across desktop and mobile layouts.

### Physical regions

Regions are expressed in millimeters and are part of `DesignSpec.regions`:

| Region | Origin `(x, y)` | Size `(width × height)` |
| --- | ---: | ---: |
| Sky | `(0, 0)` | `279.4 × 355.6 mm` |
| Engraving/photo | `(34.7, 54.5)` | `210 × 125 mm` |
| Custom text | `(34.7, 210)` | `210 × 86 mm` |

The fixed M3 stars use `xMm`, `yMm`, `magnitude`, `holeSizeMm`, and `ledIndex`. The star at `(139.7 mm, 177.8 mm)` is the physical center of the artwork and is rendered through the same conversion as every other star.

Astronomy, persistence, manufacturing output, image processing, and backend integration are intentionally outside this milestone.
