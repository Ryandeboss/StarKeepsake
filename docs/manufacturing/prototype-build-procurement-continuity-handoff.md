# StarKeepsake physical build + procurement continuity handoff

Last updated: **2026-11-18**

Purpose: this is the continuity document for the ChatGPT conversation focused on **turning StarKeepsake into a physically manufacturable product**: print quality/bleed, photo mounting, star apertures, LED retention, electronics, tools, procurement, per-order costing, assembly, QA, packaging, and the website changes required by those manufacturing decisions.

This file is intentionally distinct from:

- `docs/manufacturing/etsy-customer-checkout-handoff.md` — customer design -> Etsy checkout -> paid production order flow.
- `docs/manufacturing/m4-physical-prototype.md` / `m5-assembly-qa.md` — milestone-oriented implementation docs.

## Continuity rule

For the active physical-build/procurement chat, update **this same file after each substantive turn** with:

1. what the user asked;
2. decisions made;
3. files/sheets/code changed;
4. tests still required;
5. the exact next step.

Do not silently turn prototype assumptions into production requirements.

---

# 1. Product direction

StarKeepsake is a personalized illuminated night-sky/photo frame sold through Etsy and customized through the StarKeepsake web app.

Current physical direction:

- approximate visible composition: **11 x 14 in**;
- premium printed-photo version first;
- customer's final image professionally printed on luster/satin paper;
- print permanently mounted to a rigid black substrate;
- physical illuminated stars match real astronomical positions;
- premium home-decor appearance rather than an RGB/gadget look;
- subtle independent star twinkle;
- star brightness should relate to astronomical magnitude where practical;
- hidden warm/neutral accent lighting may be used if it improves the product;
- no exposed LED strip dots;
- product should still look finished when powered off.

The first physical prototype does **not** depend on laser engraving.

---

# 2. Simplified physical construction

The earlier multi-layer concept was simplified.

Current conceptual cross-section:

```text
viewer
↓
clear acrylic / glazing
small air gap
finished printed composition
pressure-sensitive mounting adhesive
3 mm black SINTRA / expanded PVC panel
tiny star aperture through print + adhesive + panel
black StarPod / LED holder on rear
warm-white LED behind aperture
wiring harness
removable electronics carrier
rear cover
```

Important:

- the customer-facing photo and night-sky design are one finished printed composition;
- the print mounts directly to one rigid black SINTRA panel;
- the star holes are made through the bonded print + adhesive + SINTRA composite;
- the LED body stays entirely behind the artwork;
- the viewer should see a tiny point of light, not an LED dome.

---

# 3. Substrate and print decisions

## Rigid panel

Prototype 1 substrate:

- **3 mm black SINTRA / expanded PVC**;
- flat/lightweight enough for approximately 11x14;
- black core helps star apertures visually disappear;
- electrically nonconductive.

Critical safety rule:

> Never laser-cut or laser-engrave PVC/SINTRA.

Use mechanical drilling/punching/routing only.

If future manufacturing requires laser-cut substrate, use a validated laser-safe material instead.

## Print

Current direction:

- professional **11x14 archival luster/satin photo print**;
- unmounted;
- no border;
- no lamination;
- StarKeepsake controls mounting, drilling, and substrate.

Current local starting candidate discussed in this chat:

- PROCAM Photo & Video Gear / PROCAM Prints.

Do not treat the current printer choice or price as production-final without re-verifying.

---

# 4. Print mounting process

Current adhesive starting candidate:

- **Drytac MultiTac White** pressure-sensitive mounting film, or a tested equivalent.

It is not production-approved until tested using the exact print paper + SINTRA combination.

Avoid using ordinary craft glue, glue sticks, random tape strips, or untested spray/contact adhesive as the production mounting method.

Current workflow:

1. clean work area;
2. inspect SINTRA under raking light;
3. inspect print by edges only;
4. mark TOP and design/order ID on rear;
5. dry-position print;
6. cut mounting film slightly oversize;
7. apply film to board first;
8. expose only a short leading strip initially;
9. roll progressively with a clean brayer;
10. burnish film to board;
11. position print while upper liner remains;
12. create a controlled mounting hinge;
13. protect luster face with clean release sheet;
14. laminate progressively;
15. push air toward free edges;
16. stop/rework immediately if a bubble appears;
17. final burnish;
18. trim only after bond is established;
19. inspect again under raking light;
20. reject visible bubbles, wrinkles, debris, lifted corners, scratches, dents, or front-side adhesive contamination.

Do **not** pre-cut star holes in the loose print.

Bond the print first, then make apertures through the completed print/adhesive/SINTRA sandwich.

---

# 5. Direct-LED star architecture

Current Prototype 1 direction is **direct LEDs behind tiny star apertures**, rather than PMMA fiber optics.

This may eliminate:

- PMMA fiber;
- separate fiber couplers.

The old vague `LIGHT_BAFFLES` concept became the StarPod holder/baffle.

Current LED chosen for prototype design:

- **Lumimax LED3FWAW**
- 3 mm;
- flat-top;
- warm white;
- approximately 3000 K;
- wide viewing angle.

Do not connect a bare LED directly to uncontrolled 5 V. Use proper current limiting / the validated LED-driver architecture.

---

# 6. StarPod / LED holder

A custom black 3D-printed holder was designed around the LED3FWAW body.

Purpose:

- center the LED behind the aperture;
- mechanically retain it;
- create a black light tunnel/baffle;
- prevent side-light leakage;
- keep the LED body hidden;
- allow LED replacement;
- avoid gluing the LED body directly to the artwork panel.

Current design concept:

- opaque black PETG;
- mounting flange against rear of SINTRA;
- central light tunnel;
- rear LED cavity;
- hard stop controlling LED-to-panel distance;
- LED should remain removable where practical.

The exact LED-to-panel distance still requires optical testing.

## StarPod source

The editable OpenSCAD source was created and also placed into the Google Sheet in the **StarPod Code** tab.

Main variable:

```scad
led_bore = 3.40;
```

That value is not universal. FDM printers and filament vary.

## Fit coupon

A separate OpenSCAD fit coupon was created with nominal bores:

- 3.20 mm
- 3.30 mm
- 3.40 mm
- 3.50 mm

Workflow:

1. print coupon with the same black PETG, nozzle, layer height, wall settings, and slicer settings that will be used for StarPods;
2. test an actual LED;
3. use the smallest bore that accepts the LED without excessive force;
4. update `led_bore` in the StarPod model;
5. print the production test pods.

The source is also in the Google Sheet under **Fit Coupon Code**.

---

# 7. Star-aperture test workflow

Do not drill the first customer panel before coupon testing.

## One-star coupon

Use:

- scrap 3 mm black SINTRA;
- scrap of the exact luster print;
- same mounting film;
- same mounting procedure.

Current first-experiment aperture discussed: approximately **1.2 mm**.

That is a test value, not a production dimension.

Suggested process:

- artwork side up;
- sacrificial backing under SINTRA;
- sharp micro drill bit;
- drill perpendicular;
- feed gently from print side toward rear;
- clean only loose rear burrs;
- inspect front under magnification and raking light;
- backlight the aperture.

Reject torn crescents, delamination, fuzzy white edges, elongated holes, or obvious front damage.

## LED-distance test

After one clean aperture:

1. dark room;
2. current-limit one LED safely;
3. center LED behind hole;
4. start close to rear panel;
5. move backward in small increments;
6. choose the nearest distance producing a clean light point without halo, bright patch, or visible LED body;
7. use that measurement to finalize the StarPod stop geometry.

---

# 8. Brightness calibration

After the one-star coupon works, build a four-star calibration coupon.

Initial experimental aperture sizes discussed:

- 0.8 mm
- 1.0 mm
- 1.4 mm
- 1.8 mm

These are **starting test sizes only**.

Use the same LED type behind each and test both:

- physical aperture diameter;
- PWM brightness.

Goal: derive a repeatable mapping between astronomical magnitude and perceived physical star brightness.

Do not treat any illustrative PWM percentages from earlier discussion as production values until physically measured.

---

# 9. Variable physical star count: N, not 24

Important correction made late in this conversation:

> **24 is not the product's fixed star count.**

Define:

```text
N = number of physical illuminated stars selected for this specific customer design
```

N may be lower or higher than 24.

Examples:

- 12-star design -> 12 LEDs + 12 StarPods;
- 29-star design -> 29 LEDs + 29 StarPods;
- 43-star design -> 43 LEDs + 43 StarPods.

The electronics scale around the artwork rather than forcing the artwork to fit one driver board.

Current TLC5947 scaling rule:

```text
driverCount = ceil(N / 24)
```

Examples:

- N = 1–24 -> 1 driver;
- N = 25–48 -> 2 drivers;
- N = 49–72 -> 3 drivers.

Current harness grouping concept:

```text
connectorGroupCount = ceil(N / 12)
```

The exact connector family is not yet selected.

All star-specific manufacturing data should use indices:

```text
0 ... N-1
```

Do not use fixed 0–23 assumptions.

---

# 10. Current electrical architecture

Prototype controller:

- **Raspberry Pi Pico W**;
- user already owns two, but replacement cost still belongs in product economics.

Prototype star driver:

- **Adafruit TLC5947 24-channel 12-bit constant-current PWM breakout**;
- cascade multiple boards when N > 24.

Current star concept:

- common +5 V anode bus;
- one individually controlled cathode channel per illuminated star;
- each LED retained in its own StarPod;
- channel numbers must match the M5 manufacturing file.

Current accent-light concept:

- warm-white 5 V COB strip;
- aluminum channel;
- frosted diffuser;
- separate logic-controlled MOSFET board;
- exact strip, current, length, mounting position, and driver load still require testing.

Current power direction for Prototype 1:

- **regulated wall power**, not battery power;
- final adapter rating waits until the complete prototype's worst-case current is measured;
- final power-entry connector / USB-C vs other connector is not yet selected;
- add strain relief;
- add appropriate main fuse/protection near the power entry;
- use a proper distribution point rather than buried splices.

A battery version was discussed earlier but intentionally deferred because it adds charging, protection, runtime, access-door, and shipping complexity.

---

# 11. Rear electronics / serviceability

Do not glue the Pico W or LED-driver board directly to the artwork panel.

Current architecture:

```text
artwork panel + StarPods
        ↓
numbered star harness
        ↓
service connectors
        ↓
removable electronics carrier
   ├─ Pico W
   ├─ TLC5947 board(s)
   ├─ accent MOSFET board
   ├─ power distribution
   └─ fuse / protection
        ↓
external power entry
```

Carrier goals:

- removable;
- nonconductive;
- boards mounted on standoffs/screws;
- connectors accessible;
- Pico USB accessible during prototyping;
- Pico antenna region kept clear;
- wiring organized in planned lanes.

Harness goals:

- no spaghetti wiring;
- numbered channels;
- short LED leads;
- heat-shrink at exposed joints;
- removable cable clips/tie mounts/printed channels;
- service loops where useful;
- major subassemblies should unplug rather than being permanently hard-wired.

Current scalable connector concept:

- keyed multi-pin groups, approximately 12 cathode channels per connector group;
- enough groups for N stars;
- separate star-power connector;
- separate accent-light connector.

Exact connector family and matching crimp tool remain unresolved sourcing items.

---

# 12. Complete assembly-guide continuation

A full Word assembly guide was generated during this conversation:

**StarKeepsake Prototype 1 Complete Assembly Guide**

It expanded the earlier photo/star guide through the rest of the build:

- common LED power bus;
- numbered cathode channels;
- scalable/cascaded TLC5947 driver architecture;
- removable harness connectors;
- Pico W + TLC5947 carrier;
- accent MOSFET branch;
- first-power-up procedure;
- channel-walk testing;
- dark-room optical testing;
- wire dressing;
- rear cover;
- external power entry;
- strain relief;
- glazing/frame cleaning;
- hanging-hardware validation;
- burn-in;
- firmware/customer configuration;
- astronomical QA;
- QC photography;
- customer instructions;
- protective packaging;
- final shipment checklist.

The conversation copy was rendered/visually checked after creation.

If a future chat needs the exact Word document, retrieve/re-upload the generated DOCX rather than guessing from this summary.

Important correction: any 24-specific language in that guide should be treated as a **prototype example**, not a permanent product limit. Production logic must use N.

---

# 13. Burn-in and final QA direction

Before rear cover is permanently considered complete:

- verify no shorts/unexpected continuity;
- verify LED polarity/channel mapping;
- run a channel-walk test across 0...N-1;
- verify every selected star lights;
- verify no unselected/adjacent channel cross-talk;
- inspect from normal viewing distance;
- inspect from off-axis angles;
- inspect in a dark room;
- verify no light leaking sideways from StarPods;
- verify accent-light diffusion;
- check frame/panel/holder temperatures;
- perform multi-hour burn-in;
- confirm Pico/driver reset behavior after power cycling.

Optional but useful tool:

- IR thermometer or thermocouple for burn-in measurements.

Final product QA should also include:

- clean glazing;
- no dust trapped inside;
- no artwork defects;
- correct orientation;
- correct order/design ID;
- correct customer date/time/location configuration;
- correct selected stars;
- correct star identifiers/magnitudes where used;
- secure rear cover;
- no loose hardware;
- hanging hardware validated for finished weight;
- front/rear QC photos before packaging.

---

# 14. Packaging direction

Current packaging requirements added to the procurement list:

- protective shipping carton;
- immobilizing inserts;
- corner protection;
- face/glazing protection;
- separate padded compartment/pouch for wall adapter and cable;
- no loose adapter capable of striking the frame;
- customer setup/care insert.

Final packaging dimensions and drop/fit tests wait for the actual production frame.

---

# 15. Google procurement/workbench workbook

Current Google Sheet:

https://docs.google.com/spreadsheets/d/1m61F5N6XQEoxVXYYxvwu6PRnUs2zyOOq6-Wn8pMD1BQ/edit

Title currently:

**StarKeepsake — Order Materials, Tools & Print Files**

The sheet was deliberately simplified from an over-engineered database-style workbook.

Current tabs:

## START HERE

Explains the prototype architecture and sourcing rules.

## Buy Per Order

Items generally triggered by a specific Etsy order.

Current examples:

- one customer-selected frame;
- one customer-specific professional print;
- photo-lab pickup/travel expense.

The print-lab travel row exists because the real cost includes getting the print, not just the print price.

Travel-cost rule:

- enter total round-trip gas + tolls + parking;
- divide that trip across however many customer print orders were picked up on the same trip;
- driving labor/time is not yet included.

## Pack Stock

Pack/small-inventory components pulled from stock.

Current important rows include:

- LED3FWAW LEDs: quantity = **N**;
- Pico W: 1/frame;
- TLC5947 boards: **ceil(N/24)**;
- accent MOSFET board;
- regulated 5 V wall adapter;
- external power-entry hardware;
- main fuse/protection;
- power distribution;
- keyed star-harness connector pairs: approximately **ceil(N/12)**;
- separate star-power connector;
- separate accent connector;
- standoffs/screws;
- cable-management hardware;
- rear-cover hardware;
- hanging-hardware upgrade if required;
- protective carton/inserts;
- face/corner protection;
- padded adapter compartment.

## Bulk Stock

Sheet/roll/spool/length materials.

Current important rows:

- 3 mm black SINTRA;
- mounting film;
- opaque black PETG;
- 22–24 AWG stranded red wire for common star bus;
- 26 AWG stranded wire for individual star cathode channels;
- separately sized main-power/accent-branch wire;
- heat-shrink;
- warm-white COB strip;
- aluminum channel + diffuser;
- neutral-cure black RTV / tested StarPod adhesive;
- instruction-card stock;
- frame-spacer strip stock if required.

## Make Per Order

Items fabricated/generated per customer frame.

Current rows:

- 1:1 drilling template / M5 manufacturing packet;
- StarPods: **N**;
- one star wiring harness using N numbered cathode wires;
- accent-light channel assembly;
- electronics carrier;
- removable rear cover;
- printed care/setup insert.

## Tools & Supplies

Reusable tools, consumables, software, and prototype-test pieces.

Important entries include:

- clean cutting/work surface;
- nitrile gloves;
- microfiber;
- clean hand air blower;
- bright task/raking light;
- metal straightedge;
- brayer;
- sharp knife + spare blades;
- clean weights/press boards;
- release paper;
- low-tack masking tape;
- soft face-down assembly pad;
- digital calipers;
- pin vise;
- micro drill bits;
- sacrificial backing;
- magnifier/loupe;
- fine deburring tool;
- optional mini drill press/rotary stand;
- FDM printer;
- OpenSCAD;
- slicer;
- flush cutters;
- soldering iron;
- solder;
- flux;
- wire stripper;
- helping hands;
- crimp tool matched to final connector family;
- multimeter with diode-test mode;
- current-limited 5 V bench supply / LED test source;
- precision screwdriver set;
- heat gun;
- clamps;
- labels/marker;
- known-good Pico USB data cable;
- development computer;
- optional IR thermometer/thermocouple;
- scale;
- phone/camera;
- glazing-safe cleaner;
- scrap SINTRA;
- scrap luster print + mounting film;
- StarPod fit coupon;
- four-star aperture calibration coupon;
- extra LED3FWAW LEDs.

Existing `Already own?` checkboxes were preserved where possible.

## StarPod Code

Full editable OpenSCAD source.

## Fit Coupon Code

Full editable OpenSCAD source.

Do not re-expand the sheet into a complicated database unless there is a real operational need.

---

# 16. Procurement rules

When supplier research begins:

- use current, buyable products;
- include exact links;
- include pack quantity;
- include current pack price;
- include actual cost consumed per frame;
- include shipping/tax when material;
- capture stock/lead time;
- give at least one practical backup for critical parts;
- do not invent supplier values;
- do not mark uncertain prototype parts as Approved;
- do not purchase automatically;
- keep HOLD/Research status where physical validation is still required.

Per-order economics must distinguish:

- customer-specific purchases;
- pack inventory consumed;
- bulk material consumed;
- parts fabricated in-house;
- travel/pickup expense;
- reusable tools.

---

# 17. Website changes discovered from physical manufacturing

Two website/manufacturing changes were identified as required.

A separate prompt was prepared for the website-development chat. Do not assume implementation is complete without inspecting the current code/repo.

## A. Print bleed / safe area

The customer preview should still show the intended visible 11x14 composition.

The manufacturing/print export needs explicit:

- bleed area extending the actual artwork beyond all four trim edges;
- final trim area;
- safe area;
- document dimensions;
- bleed amount;
- final trim dimensions;
- pixel dimensions;
- DPI.

Do **not** create bleed by adding a white border.

The actual artwork must extend into the bleed.

The bleed value should be configurable, not a magic number spread through the code.

The manufacturing packet should preserve the bleed/trim/safe-area metadata.

## B. Maximum/selectable physical-star system

The web app should distinguish:

- `displayStars`: digitally rendered astronomical stars;
- `physicalStars`: the subset receiving physical LEDs.

Introduce a configurable product limit such as:

```text
MAX_PHYSICAL_STARS
```

Do not hard-code 24.

If more eligible stars exist than the physical product limit, select stars deterministically using a strategy that:

- strongly favors brighter/more significant stars;
- preserves natural spatial distribution;
- avoids physical crowding;
- respects minimum physical separation in projected artwork coordinates;
- never moves astronomical coordinates to make them fit;
- gives the same result for the same design/settings.

The user/admin should be able to inspect which stars are selected and manually choose which physical stars remain if desired.

The manufacturing output should contain exactly N selected physical stars and use LED indices 0...N-1.

Search the code for hidden fixed-24 assumptions before considering this finished.

Relevant repo document currently present:

- `docs/manufacturing/print-bleed-and-physical-stars.md`

Inspect that file/current code before assuming the website changes are already deployed.

---

# 18. Current open decisions / tests

Still unresolved or not production-approved:

1. exact production frame model(s);
2. actual usable internal frame depth;
3. final glazing/air-gap/spacer solution;
4. final StarPod LED-to-panel distance;
5. final StarPod bore after real fit coupon;
6. final aperture-size-to-magnitude mapping;
7. final PWM brightness curve;
8. final maximum physical-star count;
9. exact physical-star minimum separation;
10. exact connector family;
11. exact crimp terminals/tool;
12. final power-entry connector;
13. final wall-adapter current rating;
14. final fuse value;
15. final main-power/accent-wire gauge;
16. final accent strip/channel length and position;
17. measured full-load current;
18. final burn-in temperature limits;
19. final packaging dimensions;
20. final hanging hardware based on completed frame weight;
21. final print lab and exact per-print/pickup cost;
22. final supplier links/prices for the procurement workbook.

Prototype measurements should drive these decisions.

---

# 19. Important constraints and working preferences

- User wants instructions at practical workbench detail.
- Minimize unnecessary complexity/layers.
- Do not assume fiber optics are needed.
- Do not claim dimensions or adhesives are production-approved before testing.
- Do not automatically purchase anything.
- Vercel has a deployment-limit constraint; batch web changes and minimize unnecessary pushes.
- Pico W is preferred because the user already owns two.
- Keep the rear electronics serviceable.
- Preserve astronomical accuracy.
- Physical star count is variable N.
- The web preview can remain rich/detailed even if only a subset becomes physical LEDs.

---

# 20. Conversation chronology / decisions made

This physical-build/procurement conversation progressed roughly as follows:

1. User asked for a full material/tool audit based on the two existing assembly/mounting guides.
2. StarPod concept was formalized and editable OpenSCAD source + fit coupon source were created.
3. Google Sheet was simplified from many database-like tabs into practical purchasing/workbench tabs.
4. Sheet structure was then separated into Buy Per Order / Pack Stock / Bulk Stock / Make Per Order.
5. Print-lab pickup/travel was added as a real per-order cost.
6. The physical tutorial was completed past star-hole/LED installation through electronics, carrier, power, QA, burn-in, rear cover and packaging.
7. Parts and tools were reconciled against that completed guide.
8. TLC5947 + separate accent MOSFET architecture became the current prototype direction.
9. The user challenged the fixed 24-star assumption.
10. The model was corrected to variable N; sheet quantities and driver/harness scaling were updated.
11. Two web/manufacturing updates were identified: print bleed/safe-area export and a configurable/manual physical-star-selection system.
12. A detailed prompt was prepared for the separate website-development chat.

---

# 21. Exact next step

At the end of this handoff creation turn, the next physical-build/procurement step has **not yet been selected by the user**.

Likely high-value next choices are:

- source and price the remaining Pack Stock / Bulk Stock rows;
- physically build the one-star coupon;
- print the LED fit coupon and StarPod;
- finalize the scalable connector family;
- update the complete assembly guide from fixed-24 examples to variable N;
- inspect the website branch/code to confirm bleed + physical-star selection implementation;
- define the physical maximum-star count experimentally.

Do not choose one silently if the user asks to continue generally; infer from the immediate next message and this handoff.
