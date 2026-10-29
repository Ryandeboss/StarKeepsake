# Design Specification Contract

`design-spec.v1.schema.json` is the canonical JSON Schema for a physical StarKeepsake design. The companion `design-spec.ts` file provides the TypeScript representation and shared v1 geometry constants used by the frontend.

## Version 1 physical model

- Canvas: `279.4 mm × 355.6 mm` (11 × 14 inches)
- Origin: top-left corner at `(0, 0)`
- X increases to the right; Y increases downward
- Star positions, hole sizes, and region rectangles are expressed in millimeters
- `magnitude` is display metadata for a fake/deterministic star field in M3; it is not an astronomy calculation

## v1.1 moment model

M4 makes location and time canonical instead of storing a free-form place string.

- `moment.location` is either `null` or a resolved location with formatted address, latitude, longitude, IANA time zone ID, and geocoding confidence.
- `moment.localDateTime` stores the selected wall-clock date/time without an offset.
- `moment.utcDateTime` stores the corresponding UTC instant.
- When `exactTimeUnknown` is true, `time`, `localDateTime`, and `utcDateTime` remain `null`. M4 intentionally does not invent an astronomy time.
- The customer-facing free-form query is retained as `location.query` only after a concrete location has been selected and resolved.
