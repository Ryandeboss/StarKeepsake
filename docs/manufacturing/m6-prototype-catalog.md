# StarKeepsake M6.3 initial prototype materials catalog

This catalog is a **physical shopping/workshop discovery checklist**, not yet an approved manufacturing BOM or an automatic purchasing queue.

File: \`docs/manufacturing/m6-prototype-catalog.json\`

- Both requested 11×14 finishes are represented: two-tone walnut, planned 2.5-inch depth, and matte black, planned 3.5-inch depth. Frame suppliers, actual internal clearances, mounting and usable depth are still unverified.
- The user reported owning **two Raspberry Pi Pico W boards**. This is explicitly marked as **reported**, not verified stock. They will be counted as inventory only after a physical check.
- Professional satin/luster print and rigid mounting, warm-white star emitters, fiber-optic coupling and concealed warm COB lighting are captured as line items. Quantities are *fit-check placeholders*, not production-ready quantities.
- The Adafruit TLC5947 breakout is a **verified manufacturer-specified candidate**: 24 individual constant-current PWM output channels; its vendor page showed a $14.95 retail price on Nov 11, 2026. This is for **research only**. It is not an Amazon ASIN, an accepted landed cost, or proof that the star-point count and electrical/current budget have been validated.
- URLs: https://www.adafruit.com/product/1429 ; https://www.ti.com/product/TLC5947 . See manufacturer and board electrical specifications for current limits. The Pico W product information is at https://www.raspberrypi.com/products/raspberry-pi-pico/ .
- All \`unitCostCents\` and \`amazonAsin\` are intentionally \`null\`. No available vendor/supplier prices or physical pack sizes were fabricated.
- This file is **not seeded** into live Supabase. M3 only receives a supplier item after owner verifies specifications and costs; a recipe must be reviewed after the physical prototype confirms quantities.
- The first physical safety gate is confirming a suitable certified *external* low-voltage adapter, fuse, wiring gauge, LED driver current and thermal behavior. No mains circuitry should be built into the frame.
- The TLC5947 has 24 independently controlled channels, which does not automatically mean that an arbitrary astronomical star count can be twinkled independently. Additional channels, intentional groups or another driver strategy may be needed.
- To turn candidates into real parts: measure the frame and photo cutout, calculate count/coordinates of the desired illuminated stars, choose each LED/fiber/power component, verify supplier ASIN and pack quantities, enter verified landed costs and inventory, and perform a full dark-room and electrical bench QA.

## M6.3 simulated procurement controls

The simulation proposal is derived from existing verified paid Etsy jobs and current M3 BOM shortages; it does **not** create supplier purchases. The owner can enter *hypothetical* order/day budget caps, save one immutable snapshot per combination of job IDs + stock/cost snapshot + cap values (SHA-256 uniqueness), mark a snapshot **simulated reviewed**, or void an unreviewed simulation.

A separate Supabase 005 migration creates an owner-only simulation audit ledger and RPCs. Database constraints and transaction locks prevent idempotency reuse and enforce simulated caps, including concurrent reviews. Even a reviewed simulation has \`simulation_only=true\` and no Amazon cart/order, shipment, charge or payment method.

**No real ordering path is implemented or authorized.** Before any real purchasing pilot, add verified live Product Search offers, Cart API landed totals, fresh receipt status re-checks, immutable real order intent IDs, explicit owner authorization, per-order/daily caps for *actual* spending, account-side Amazon safeguards, supplier orderDetails reconciliation and handling of delivery failures/refunds. See https://docs.business.amazon.com/docs/ordering-api and https://docs.business.amazon.com/docs/cart-api-overview .

Deployment: PR stays draft, SQL 005 is not to be applied to production until an approved release. The source catalog requires separate vendor/spec signoff.
