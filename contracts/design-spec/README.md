# Design Specification Contract

`design-spec.v1.schema.json` is the canonical JSON Schema for a physical StarKeepsake design. The companion `design-spec.ts` file provides the TypeScript representation and shared physical geometry constants used by the frontend.

## Physical model

- Canvas: `279.4 mm × 355.6 mm` (11 × 14 inches)
- Origin: top-left corner at `(0, 0)`
- X increases to the right; Y increases downward
- Star positions, hole sizes, and region rectangles are expressed in millimeters

## v1.1 moment model

M4 makes location and time canonical instead of storing a free-form place string.

- `moment.location` is either `null` or a resolved location with formatted address, latitude, longitude, IANA time zone ID, and geocoding confidence.
- `moment.localDateTime` stores the selected wall-clock date/time without an offset.
- `moment.utcDateTime` stores the corresponding UTC instant.
- When `exactTimeUnknown` is true, `time`, `localDateTime`, and `utcDateTime` remain `null`.
- The customer-facing free-form query is retained as `location.query` only after a concrete location has been selected and resolved.

## v1.2 astronomy model

M5 replaces the M3 placeholder stars with a server-generated Hipparcos star field.

- `astronomy` records the catalog, ephemeris, projection, orientation, calculation UTC time, time basis, selection settings, and star counts.
- `stars[]` stores physical `xMm`/`yMm` plus Hipparcos ID, apparent altitude/azimuth, visual magnitude, hole size, and LED index.
- The projection is `azimuthal-equidistant`, with zenith at the artwork center, north up, east right, and the horizon at the projection circle edge.
- Stars inside the reserved engraving-photo and text regions are omitted rather than moved; remaining star coordinates preserve the real projected sky geometry.
- The default selection uses magnitude limit 6.0, up to 96 stars, and 3.5 mm minimum physical separation.
- If the exact time is unknown, M5 explicitly calculates a representative sky at local midnight and records `timeBasis = date-only-local-midnight`. The UI must disclose that this is representative rather than exact.
- Fake placeholder stars are no longer part of the canonical DesignSpec.
