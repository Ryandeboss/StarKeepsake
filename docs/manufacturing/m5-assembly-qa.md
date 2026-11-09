# M5 — Offline assembly workbook and quality gates

**Status: DRAFT / OFFLINE / NOT APPROVED FOR LASER OR CUSTOMER PRODUCTION.** This is the first M5 implementation, not a physical prototype verification. M3 material/cost/stock PR #59 remains unmerged and is not required for the local guide.

## Generate an order-specific workbook

First obtain a saved non-sensitive StarKeepsake sample design and download its local maker packet. Extract order.json. Run M4 to generate a nominal-millimeter reference and numbered LED plan:

    python tools/prototype/artwork.py path/to/order.json --out output/m4 --leds 24

Optionally copy docs/manufacturing/measurements.example.json to a local, private measurements.json. Replace null values only when real frame opening width/height, internal depth, frame/LED/supply product models and substrate have been measured or confirmed.

    python tools/prototype/assembly_guide.py --m4 output/m4 --measurements path/to/measurements.json --out output/m5

You can omit --measurements entirely; the guide will explicitly flag missing physical dimensions.

The offline tool writes:
- assembly_guide.html — self-contained printable guide tailored to the selected logical LED count, coordinates and measured frame dimensions. It has interactive review checkboxes and a browser-local JSON progress download. It makes no network calls, writes no server data, does not persist browser secrets and never sets customer-production approval.
- assembly_workbook.json — nine unverified staged QA tasks plus evidence requirements. Status is HOLD_NOT_APPROVED, paymentVerified false and manufacturingAuthorized false even if every checkbox is clicked.

## Nine work stages

1. Identify a saved design and independent Etsy payment status if considering a customer build.
2. Measure actual opening, rabbet, backing and usable depth; compare with nominal artboard.
3. Verify paper/printed photo substrate and scale on scrap. Existing engraving grayscale preview is not a calibrated laser production file.
4. Confirm real optical routing, light guides/fibers, clearance and chosen LED index map.
5. Inspect Pico 2 W, suitable external protected 5V power, logic-level shifting, grounding, cable ratings and bench current/temperature.
6. Supervised low-brightness firmware, power-on/power-off, reset and indexing tests.
7. Mechanical assembly, service access, photo registration, light leak checks.
8. Fit, thermal, visual, handling and packaging QA with dated evidence.
9. Separate owner approval to manufacture, after paid Etsy verification, final physical part BOM and relevant safety reviews.

**No SVG, HTML or JSON output is a laser toolpath, paid-order authorization, wiring certification or manufacturing release.** Never infer real LED current, physical tolerances, power-supply sizing, laser compatibility or fabrication settings from nominal artwork.

## Tests and handoff

    python -m unittest discover -s tools/prototype/tests -v

The new tests verify an M4-to-M5 roundtrip, no accidental fulfillment authorization, invalid map rejection, missing/partial measurements, nonuniform scaling detection and HTML escaping. No new secrets, Azure services, Supabase tables or production web pages.

Keep M5 in a single review PR until physically measured hardware is available. When actual frame and electronics are selected, review a measured test build, then consider integration into the owner M3 production dashboard. Updates belong in the living GitHub handoff issue #58, not source documentation commits.
