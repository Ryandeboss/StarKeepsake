# M4 — Physical StarKeepsake prototype toolkit

State: DRAFT / CALIBRATION-ONLY. This is not a laser-ready production file, a certified electrical design, or approval to fulfill Etsy orders. M3 materials/stock PR #59 remains draft.

## Offline registration artwork

Input is the order.json file in the customer maker ZIP produced by the live app after Save Design. The design must have a permanent 16-hex SK ID. It may be UNPAID_PREVIEW: this is not proof of payment and is used solely for a supervised sample prototype.

From the repo root, with Python 3.11 or later:

    python tools/prototype/artwork.py path/to/order.json --out path/to/prototype --leds 24

Output is local only:
- registration_reference.svg: nominal millimeter artwork regions and star CENTER CROSSHAIRS ONLY, no cutting paths or hole contours.
- led_map.json: 1–30 logical physical LED indices, catalog IDs, nominal XY mm and magnitudes.
- prototype_review.json: warning/status/physical dimensions without customer name, address, photo or secret access key.
- READ_ME_FIRST.txt: explicit safety/QA preflight.
The tool uses no web requests, databases or laser devices. It does not create paid orders or buy supplies.

IMPORTANT: Canonical astronomy stars are not necessarily the same physical composition as the immersive sky camera or the within-photo layered preview. Compare the selected heading/pitch/horizon and alpha foreground to the proposed physical stars before any manufacture. Never represent these marks as a finished customer artwork or approved drill pattern.

## Mandatory mechanical verification before real fabrication

- The artboard uses NOMINAL 8×10, 11×14 or 16×20 dimensions (or an auto layout). Measure actual frame inside opening/rabbet, backing, mat thickness and physical tolerance with tools. The printed reference must be verified at scale against these measurements.
- Print registration_reference.svg and inspect manually. It contains no cutting power, speed, kerf, focus or laser machine commands. It is deliberately NOT machine-ready and must not be sent directly to a cutter. Use a separate reviewed manufacturing drawing after calibration.
- The sample star map defaults to brightest 24 (max 30) with a nominal 3.5mm separation and near-edge filtering. Actual LED/light-guide diameters, drill bits, opacity, photo mask and optics determine final locations and acceptable spacing. Do not assume a flexible LED strip can occupy all XY positions without a light-guide manifold or fibers.
- The existing server grayscale photo engraving preview is NOT a calibrated laser raster or a real engraving proof. Check image crop, substrate material, photorealism and ink/engraving process on offcuts before offering it commercially.
- Follow the actual laser equipment manufacturer's ventilation, shielding, fire-watch, lens/focus, material-compatibility and local safety guidance; never leave a running laser unattended.

## Raspberry Pi Pico 2 W LED bench setup (OFF by default)

Files: firmware/pico2w/main.py, effects.py, settings.example.py. Controller runs MicroPython only. No Wi-Fi, credentials or network controls. LEDs do not turn on without a manually created settings.py with both LEDS_ENABLED and WIRING_REVIEWED true.

Example (NOT a verified finished-product circuit): Pico 2 W GPIO0 digital data output -> proper 3.3V to 5V logic level buffer (e.g. suitable 74AHCT125 stage) -> 300–500 ohm series resistor near DIN of a verified WS2812/NeoPixel-compatible 5V strip. Provide a separate appropriately rated, protected, certified 5V supply for the LED power rails. Pico and strip GND must be common, including level shifter reference. A properly rated 500–1000 µF reservoir capacitor across LED power and GND at the strip entry can reduce transients; check polarity and required voltage. Use strain relief, insulation, suitable connectors and fuse/overcurrent protection. Do not supply LED current from the Pico's 3V3 pin. Avoid backfeeding USB, VSYS or VBUS from multiple unreviewed supplies.

At a theoretical 60mA RGB white maximum each, 24 LEDs might draw up to about 1.44 A on the LED 5V rail alone, excluding controller, buffer and headroom. This is NOT a power-supply recommendation or real-world measured current. Bench-test with a meter under your actual limits and worst-case use, check temperature and secure wiring; brightness code caps do not replace circuit protection.

Do not use the older Pico WH listing in docs/manufacturing/candidate-bom.json without revising it: M4 targets Pico 2 W, pending the actual board and strip model. Default software MAX_BRIGHTNESS = 20 out of 255 and max 30 LEDs is a low-brightness demonstration only.

Steps, after a successful bench electrical inspection: flash Pico 2 W-specific MicroPython; confirm machine and neopixel modules exist in the exact firmware build; copy settings.example.py to settings.py on the board; copy main.py, effects.py, generated led_map.json; explicitly set both flags true; run a supervised low-output test on a few LEDs and power down on any wiring/thermal issue. On a missing config it stays OFF.

## Owner physical acceptance gates

1. Measure a real frame/mat and test print scale.
2. Select actual LED and supply models; independently review electronics and power wiring.
3. Compare the real star/light-guide placement to design choice and finished customer preview.
4. Confirm actual printing/engraving equipment and exact substrate with scrap tests and photographic proof.
5. Confirm serviceability, enclosure, cooling, optical leakage and final assembly.
6. Reconcile actual hardware parts, cost, safety and lead time in M3 before accepting paid physical orders.
7. Keep M4 local until real prototype passes. No supplier checkout, laser command, or production deployment is included.

## Offline automated checks

    python -m unittest discover -s tools/prototype/tests -v

Authoritative technical references:
Raspberry Pi Pico family pinout: https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html
Adafruit addressable LED practices: https://learn.adafruit.com/adafruit-neopixel-uberguide/best-practices
LightBurn SVG import: https://docs.lightburnsoftware.com/latest/GetStarted/CreatingAndImportingArtwork/
LightBurn machine-dependent cut settings: https://docs.lightburnsoftware.com/latest/GetStarted/CutSettingsBeginner/
