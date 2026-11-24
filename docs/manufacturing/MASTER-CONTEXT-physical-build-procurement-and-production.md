# MASTER CONTEXT PROMPT — StarKeepsake physical build, procurement, manufacturing, admin production, and Etsy handoff

Last assembled: **2026-11-20**

## How to use this document

This file is intended to be pasted into a **brand-new ChatGPT conversation** so the assistant can continue the StarKeepsake physical-product/manufacturing thread without requiring the user to re-explain the project.

Treat this document as the working context for the conversation, but **do not assume every prototype choice is production-approved**. Distinguish clearly between:

- decisions already made;
- prototype defaults;
- candidate parts;
- things that require bench/fit/optical testing;
- things that require current supplier/price verification;
- software features that may already exist but still need repo inspection before changing.

When continuing from this document:

1. Preserve the existing StarKeepsake customer experience and astronomy accuracy.
2. Prefer simple, practical manufacturing workflows over unnecessary systems/abstractions.
3. Never silently reintroduce the old assumption that the product always uses 24 stars.
4. Define **N = the actual number of physical illuminated stars in the finalized customer design**.
5. Scale LEDs, StarPods, wiring, connectors, drivers, power, and BOM quantities from N.
6. Do not claim untested physical dimensions/materials/electronics are production-approved.
7. Keep the physical product serviceable: removable rear cover, service connectors, removable electronics carrier.
8. Keep customer assets private; Etsy should receive the stable StarKeepsake Design ID, not private asset URLs.
9. When a customer finalizes a design, freeze enough production data/assets that the exact purchased product can be reproduced later even if algorithms/defaults change.
10. Do not automatically buy parts or mark HOLD/Research items as approved.
11. Minimize Vercel deployments/pushes because the project has a deployment-limit constraint.
12. For current prices, suppliers, product availability, regulations, or hardware specifications, verify them rather than relying on stale assumptions.
13. For GitHub implementation tasks, inspect the actual repo/current files before editing.
14. For the ongoing physical-build chat, also maintain the rolling continuity file:
    `docs/manufacturing/prototype-build-procurement-continuity-handoff.md`.

## Current project goal

The user's near-term launch threshold is pragmatic:

> Get StarKeepsake to the point where a real customer can upload a photo, enter date/time/location, receive the correct calculated sky, customize the frame, finalize the exact design, go to Etsy and pay, and then the owner's admin account receives everything necessary to source the parts and physically build that exact purchased product.

The user does **not** need every future automation perfected before advertising. The minimum useful end-to-end loop is:

```text
customer uploads photo
-> enters date/time/location
-> StarKeepsake calculates the correct sky
-> customer customizes/finalizes exact design
-> server freezes an immutable production packet
-> customer goes to Etsy with the stable Design ID / matching variation
-> Etsy payment is confirmed
-> admin production job is created/linked
-> admin gets print files + star geometry + BOM + checklist
-> owner sources/pulls/fabricates parts
-> physical build
-> QA/burn-in
-> package
-> ship
```

The physical product being sold must still pass enough prototype/safety/quality validation to be consistently fulfillable.

---

# Comprehensive context from the active physical-build/procurement conversation

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


---

# 22. Latest decision: builder completion -> admin manufacturing packet -> Etsy paid job

User's current launch threshold is pragmatic: once a real customer can complete the StarKeepsake builder, obtain the correct sky from their place/date/time, finalize a manufacturable design, proceed to Etsy to pay, and the owner/admin can receive everything needed to physically build that exact design, the user wants to begin advertising and accepting real customers.

This means the website must treat customer finalization as a **production handoff**, not merely a saved preview.

## A. Save an immutable production design packet before Etsy checkout

When the customer presses the final buy/checkout action, save a server-side design version with a stable Design ID. That packet should include enough information to reproduce the exact purchased object later even if the public builder code, defaults, or star-selection algorithm change.

Required categories:

### Identity / linkage

- server-assigned StarKeepsake Design ID;
- immutable design-version ID / revision;
- created/finalized timestamp;
- integrity hash/checksum where practical;
- later Etsy receipt/order/transaction IDs once payment is matched;
- order/job status.

### Customer-selected product configuration

- product size / visible trim size;
- frame finish / Etsy variation;
- orientation/aspect;
- inscription/text and typography choices;
- sky-layout choice (stars above image vs woven/other supported mode);
- any customer-visible customization that changes the physical product.

### Original image + exact image-processing state

- private original uploaded image;
- final processed foreground/cutout if applicable;
- crop transform;
- scale/rotation/pan/position;
- horizon setting;
- mask/manual cleanup state needed to reproduce the result;
- final composited visible artwork preview.

Never rely on re-running an AI cutout later to recreate the customer's exact purchased artwork if the processed result can instead be stored.

### Astronomy inputs

- customer-selected date;
- time and the product's handling of unknown time;
- location text shown to customer;
- resolved latitude/longitude;
- timezone/offset assumptions used;
- astronomy/catalog/ephemeris version where needed for reproducibility;
- projection/orientation parameters;
- magnitude/visibility settings used.

### Physical-star selection

Define N as the actual number of physical illuminated stars in that design.

Store the exact finalized physical-star set, not just the rule that could recreate it.

For every physical star store at minimum:

- LED index 0...N-1;
- stable star/catalog identifier (HIP where available);
- magnitude;
- projected x/y position in the final trim coordinate system;
- normalized x/y if useful;
- selected/manual-selection state;
- aperture/brightness category or calibrated values once finalized;
- PWM/driver brightness value once the physical calibration recipe is finalized.

Also store:

- N;
- configured maximum physical-star count used at finalization;
- whether the set was auto-selected and/or manually edited.

The digital display-star set can be larger. Manufacturing uses the frozen physical-star set.

### Print-ready artwork assets

Admin should not have to recreate/export the customer artwork manually.

Store/generate:

- exact visible/trim artwork;
- print-ready artwork with bleed;
- potentially useful exact-size and alternate-bleed derivatives if the production workflow retains them;
- trim dimensions;
- bleed dimensions;
- safe-area metadata;
- DPI;
- pixel dimensions;
- color/export metadata needed by the selected print process.

The visible 11x14 composition and the larger bleed document must be explicitly distinguished.

### Manufacturing geometry

Generate a machine/workbench-ready packet containing:

- final trim dimensions;
- board orientation and TOP marker;
- exact N star-hole coordinates;
- LED index next to each star coordinate;
- star identifier/magnitude;
- aperture size/category when calibrated;
- printable 1:1 drilling template or equivalent deterministic coordinate artifact;
- any registration/reference marks that do not appear on the customer-facing artwork;
- warnings if two selected physical stars violate minimum physical spacing.

Do not make the owner measure star locations from a screenshot.

## B. Admin production job

Before payment, the saved design may exist as a pending design.

After Etsy reports a legitimate paid order and the Design ID matches exactly, create/link a production job in the admin UI.

The admin job should present, in one place:

1. Etsy order/receipt linkage and paid state;
2. Design ID/version;
3. customer's selected frame finish and product size;
4. final customer preview;
5. downloadable print-ready bleed artwork;
6. downloadable exact trim/visible artwork;
7. manufacturing/drilling packet;
8. exact physical-star table with N rows;
9. astronomy/date/time/location summary;
10. source/processed image assets for recovery, with private access;
11. per-order BOM / material requirements;
12. build checklist / QA status;
13. procurement status for anything not in stock;
14. final QC records/photos before shipment.

The admin should not need to revisit the customer-facing builder to reconstruct a production order.

## C. Per-order BOM that should be generated from the finalized design

The job should derive quantities from the actual design and the currently approved production recipe.

Customer/order-specific purchases:

- one selected frame;
- one professionally printed customer artwork;
- print-lab pickup/delivery allocation if applicable.

Materials consumed from stock:

- one 3 mm black SINTRA artwork panel;
- mounting-film area needed for that panel;
- N LED3FWAW LEDs (or current approved replacement);
- N StarPods;
- PETG consumption for N StarPods and other printed parts;
- one Pico W;
- TLC5947 driver count = ceil(N / 24) for the current prototype architecture;
- one accent-light MOSFET board if accent lighting remains part of the approved recipe;
- tested accent COB length + diffuser/channel;
- scalable star-harness wire based on N;
- star-harness connector groups based on N/current connector recipe;
- separate star-power and accent-light service connectors;
- heat-shrink;
- main power/accent wire;
- power distribution hardware;
- fuse/protection;
- one validated wall adapter + cable;
- one external power-entry/strain-relief set;
- carrier standoffs/screws;
- cable-management hardware;
- removable rear-cover hardware;
- spacer/hanging-hardware additions only when the chosen frame requires them;
- one care/setup insert;
- one protective shipping package and adapter compartment.

The admin BOM must distinguish:
- buy specifically for this order;
- pull from Pack Stock;
- consume/cut from Bulk Stock;
- Make Per Order.

Do not fake exact quantities for unresolved parts. If a component is still HOLD/Research, show that explicitly and block production readiness if it is a safety/fit-critical unresolved requirement.

## D. Etsy handoff

The website should save the production packet **before** sending the customer to Etsy.

Etsy should receive or ask for the stable StarKeepsake Design ID and the customer's matching physical variation/finish.

The customer should never paste private asset URLs into Etsy.

Etsy remains the payment/order authority. A saved design is not a paid order.

After the Etsy webhook/manual sync confirms a legitimate paid receipt:

- read the Design ID;
- match it to the frozen production packet;
- validate the purchased frame variation against the saved design;
- create/link the admin production job;
- mark it production-eligible only when payment and variation checks pass.

## E. Current product-launch interpretation

The user's present goal is not to perfect every future automation before marketing.

The minimum launch-ready loop is:

```text
customer uploads photo
-> sets date/time/location
-> builder calculates accurate sky
-> customer finalizes exact design
-> server freezes production packet
-> customer goes to Etsy with Design ID / matching variation
-> Etsy payment is confirmed
-> admin gets one production job containing artwork + star geometry + BOM + checklist
-> owner can source/use parts and physically build the exact purchased frame
-> QA -> package -> ship
```

Advertising can begin once this loop is genuinely usable and the physical recipe being sold has passed enough prototype validation to be fulfilled safely and consistently.

## F. Latest requested next action

The immediate request in this turn was to produce a prompt for the separate website-development chat that reiterates the exact data/assets/BOM that must flow from a finalized builder design into the admin production interface and Etsy linkage.



---

# Additional instruction for the next chat

If the user says something like **"continue from the physical-build chat"**, **"continue StarKeepsake manufacturing"**, **"what do I need to do next?"**, or references this document, do not restart discovery from scratch.

First determine which of the following lane the user is now working in:

- website builder / customer finalization;
- print bleed/export;
- physical-star selection;
- admin production packet;
- Etsy order matching;
- supplier sourcing / BOM pricing;
- print mounting;
- drilling/aperture calibration;
- StarPod fit/printing;
- LED/electronics wiring;
- power/protection;
- accent lighting;
- electronics carrier/rear cover;
- firmware/twinkle/brightness;
- QA/burn-in;
- packaging/shipping.

Then continue from the existing decisions and open items above.

Do not force the user to re-explain information already contained in this master context.


---

# Latest turn — Admin production view must make a paid Etsy draft physically buildable

The user clarified the current real-order flow:

- customer uses the StarKeepsake website workshop to build a draft;
- drafts are saved and visible to the owner/admin;
- if the customer wants to buy, the website gives them the draft/design ID;
- customer enters that ID in Etsy and completes payment;
- admin sees which saved draft was purchased;
- admin then physically builds that exact StarKeepsake.

The admin view therefore needs to function as a **single production workstation**, not just an order viewer.

The user wants to be able to open one paid order and immediately:

1. see exactly what the customer bought;
2. download the exact print/manufacturing files;
3. know exactly which parts/materials are required;
4. know which parts must be purchased now vs pulled from stock vs fabricated;
5. track whether all required parts have arrived;
6. follow a straightforward assembly sequence;
7. verify the finished product before shipping.

## Minimum admin order page requirements

### Order identity / purchase confirmation

Show:

- Etsy order/receipt ID;
- paid status;
- StarKeepsake Design ID / draft ID;
- immutable design version;
- customer-selected frame finish;
- Etsy variation;
- saved website variation;
- obvious mismatch warning if Etsy selection and saved design do not match;
- order date;
- current production status.

### Exact visual reference

Show:

- large final customer-approved preview;
- original customer image, privately accessible;
- final processed image/cutout;
- exact customer-visible composition;
- date/time/location;
- inscription/text;
- sky mode/layout;
- orientation;
- physical star count N.

The owner should be able to visually confirm what is being built without reopening the customer-facing workshop.

### Production files

Provide direct download/open buttons for:

- exact visible/trim artwork;
- print-ready artwork with bleed;
- any approved alternate bleed export;
- 1:1 drilling template;
- manufacturing packet/PDF;
- manufacturing JSON/data;
- star coordinate table;
- source/processed assets for recovery.

The admin view should explicitly label which file is the one to send to the print lab.

### Physical-star manufacturing table

For every physical star, show:

- LED index;
- HIP/catalog identifier where available;
- magnitude;
- X coordinate;
- Y coordinate;
- aperture size/category once calibrated;
- PWM/brightness value once calibrated;
- whether auto-selected or manually chosen.

The table must contain exactly N rows and preserve the finalized star set from the purchased design.

### Per-order BOM

The admin page must generate the actual material requirements for that exact order.

Separate clearly into:

- BUY FOR THIS ORDER;
- PULL FROM PACK STOCK;
- CONSUME FROM BULK STOCK;
- MAKE FOR THIS ORDER.

For each line show:

- item;
- required quantity;
- quantity on hand where tracked;
- quantity still needed;
- supplier/product;
- purchase link;
- pack size;
- current known price;
- order status;
- delivery status;
- allocated/used status;
- notes.

Star-dependent parts must scale with N:

- LEDs = N;
- StarPods = N;
- star-channel wire scales with N;
- TLC5947 boards = ceil(N/24) for current prototype architecture;
- star-harness connector groups scale with N/current connector recipe.

### Parts-readiness / receiving

The order page should make it obvious whether the build can start.

Each required part/material should have a status such as:

- Need to buy;
- Ordered;
- Shipped;
- Delivered;
- In stock;
- Allocated to this job;
- Fabricated;
- Ready.

The admin should have one clear overall indicator such as:

- Waiting on parts;
- Ready to build.

Do not make the owner mentally compare several tabs to decide whether all components are available.

### Build sequence / checklist

Once materials are ready, the same order page should provide a saved step-by-step manufacturing checklist, approximately:

1. verify paid order/design/version;
2. verify correct frame finish;
3. obtain/order professional print;
4. prepare SINTRA panel;
5. mount print;
6. inspect mounted artwork;
7. transfer/drill N star locations;
8. inspect apertures;
9. install N StarPods;
10. install N LEDs;
11. build/connect star harness;
12. build/install accent-light assembly if approved;
13. assemble electronics carrier;
14. install Pico W + TLC5947 board(s) + MOSFET/power hardware;
15. connect power/protection;
16. flash/load the exact customer configuration;
17. run channel-walk test;
18. dark-room optical test;
19. perform burn-in;
20. final astronomical/design QA;
21. clean glazing/frame;
22. install/close rear cover;
23. verify hanging hardware;
24. take final QC photos;
25. package;
26. mark ready to ship / shipped.

Checklist state must persist.

### Build-specific instructions

Do not only show a generic tutorial. The order page should also surface job-specific values:

- N;
- number of driver boards;
- number of harness connector groups;
- exact star coordinates;
- exact frame finish;
- exact print file;
- exact customer text;
- exact orientation;
- exact firmware/config payload;
- any conditional spacer/hardware requirement for that frame.

### QA / traceability

The job should retain:

- who/when marked major build stages complete where practical;
- burn-in completed;
- test notes;
- defects/rework notes;
- final QC photos;
- final firmware/config version;
- final star count;
- finished weight where used for hanging/shipping validation.

### Shipping readiness

Before marking ready to ship, admin should be able to confirm:

- correct customer/order;
- correct frame finish;
- clean glazing;
- no loose hardware;
- rear cover secure;
- power adapter included;
- instruction/care insert included;
- protective packaging complete;
- QC photos saved.

## UX principle

The ideal admin experience is:

```text
open paid order
-> confirm what customer bought
-> download/send print file
-> see exact parts needed
-> buy missing items / allocate stock
-> wait until Ready to Build
-> follow one persistent build checklist
-> use order-specific drilling/star/electronics data
-> complete QA
-> package
-> ship
```

The admin should not need to reconstruct anything from memory, jump back into the customer builder, or manually derive the BOM from a generic parts spreadsheet.

The production page should become the owner’s **single source of truth for physically fulfilling that Etsy order**.


---

# Latest turn — Admin production UI must be owner-friendly, not merely data-complete

The user asked for a prompt to give the coding agent that has already built the admin view.

The goal is now explicitly UX-focused:

- preserve the existing admin implementation where possible;
- audit it against the production requirements rather than rebuilding blindly;
- make a paid order feel like a clear digital work order;
- avoid clutter, giant walls of metadata, or forcing the owner to jump between multiple pages;
- put the most important action/status information first;
- progressively reveal technical detail when needed;
- make the next action obvious at every stage.

Desired top-level order-page hierarchy:

1. Production status / next action.
2. Customer-approved final design preview + core order facts.
3. Files needed right now (especially the print-lab file and drilling/manufacturing packet).
4. Parts readiness grouped as Buy for this order / Pack Stock / Bulk Stock / Make.
5. Persistent build checklist.
6. Physical-star/manufacturing details.
7. QA/burn-in/shipping readiness.
8. Advanced/raw metadata collapsed by default.

The page should answer, at a glance:

- What exactly did the customer buy?
- What do I need to do next?
- What am I waiting on?
- Which file should I send to the print lab?
- Which parts do I need to order?
- Which parts do I already have?
- Is the job ready to build?
- What assembly step am I currently on?
- Has QA passed?
- Is it ready to ship?

UX principles:

- one production job = one primary workspace;
- no requirement to reopen the customer builder to reconstruct the design;
- no requirement to mentally compare Etsy, spreadsheet, and admin data;
- use clear section grouping, concise labels, status chips, progress indicators, and prominent primary actions;
- avoid showing every technical field at the same visual priority;
- use expandable/collapsible advanced sections for raw astronomy/manufacturing metadata;
- make destructive or irreversible actions deliberate;
- preserve checklist and part statuses across refreshes;
- surface blocking mismatches/errors near the top;
- optimize for desktop workbench use, while remaining responsive.

The coding-agent prompt for this turn should ask it to inspect the existing admin implementation first, identify which requirements are already met, then make the smallest cohesive set of UI/data-flow changes needed to satisfy the production-workstation experience.


---

# Latest turn — Amazon sourcing capability

The user asked whether ChatGPT can find Amazon product links or whether ChatGPT Work can do it.

Current guidance:

- In ordinary Chat, ChatGPT can search the public web for Amazon product pages and return direct links, compare candidate products, prices, pack sizes, and specs where accessible.
- For Amazon specifically, normal product-search tooling may be limited, so standard web search/browser access is often the better route.
- ChatGPT Work is better suited for a longer sourcing workflow because it can use a cloud browser on supported websites, interact with webpages, and carry out multi-step research. Website compatibility varies and a site may block automated access.
- Work can pause for sign-in or confirmation when necessary.
- Consequential actions such as purchases should still require user review/confirmation.
- For StarKeepsake, the preferred workflow is: research exact BOM items -> compare Amazon/DigiKey/Adafruit/etc. -> capture direct links, pack sizes, current prices, shipping/availability -> update the sourcing sheet/admin BOM. Do not auto-purchase or mark items production-approved merely because a listing was found.


---

# Latest turn — This week's fake paid order / admin build rehearsal

The user wants a practical end-to-end rehearsal this week:

1. create/save a fake customer design on the live/current StarKeepsake builder;
2. make it appear in the owner admin Production view **as though paid**, without weakening or impersonating the real Etsy-paid verification path;
3. open that test production job;
4. see the exact item-specific files needed for the build;
5. see the exact item-specific parts/materials required;
6. track whether each required item/file/part is ready;
7. use a persistent per-order assembly/QA checklist so this one prototype build has its own independent progress record.

## Important current repo state discovered during this turn

- `/trial-order` already creates a synthetic local trial, but deliberately does NOT insert a fake Etsy receipt or paid production job.
- Paid owner production jobs already support frozen maker ZIP retrieval and a persisted per-order checklist via private Vercel Blob storage.
- Current retail product policy in the repo is **maximum 24 physical illuminated stars**. Each job still has its own actual `N`, where `1 <= N <= 24`.
- `manufacturingJobPlan.ts` already derives N LEDs, N StarPods, `ceil(N/24)` TLC5947 boards and `ceil(N/12)` connector groups, but current retail N<=24 means one TLC5947 board at most.
- Current print packet contains three 300-DPI variants:
  - exact 11x14: 3300x4200;
  - 1/8-in bleed: 3375x4275;
  - 1/4-in bleed master: 3450x4350.
- The current source still labels most supplier items SOURCE_AND_VERIFY / HOLD because supplier trust and physical build validation are intentionally separate concerns.
- Current `firmware/pico2w/main.py` is an old WS2812/NeoPixel bench demo. It is NOT TLC5947 production firmware and must not be presented as the final electronics configuration.

## Required fake-paid-order architecture

Do NOT bypass or weaken the actual Etsy-paid authorization check.

Create a clearly separate internal/test-order path, owner-authenticated and visibly labeled, for example:

- source: INTERNAL_TEST;
- payment state: TEST_PAID;
- receipt/order ID prefixed TEST-;
- obvious banner: TEST ORDER — NO REAL ETSY PAYMENT;
- excluded from real revenue/analytics, Etsy shipping, refunds and purchase automation;
- may use a real saved StarKeepsake Design ID so the owner can physically build the prototype.

The test order should render through the same production-job UI and manufacturing-plan logic as a real paid job as much as practical so the rehearsal actually proves the admin workflow.

## Item-specific files the admin job must expose

At minimum:

- final customer-approved preview;
- original private source photo;
- final processed/foreground image if applicable;
- `print-artwork-exact-11x14.png`;
- `print-artwork-bleed-1-8.png`;
- `print-artwork-bleed-1-4.png` (current preferred internal master, but still requires selected lab acceptance);
- matching print-spec JSONs;
- proof-only print trim/safe guides;
- frozen maker ZIP;
- star-coordinate CSV;
- star/manufacturing JSON;
- 1:1 drilling SVG/template ONLY when geometry passes validation, clearly marked proof/calibration until physically registered;
- order-specific candidate parts CSV/BOM;
- persistent build/QA checklist.

Admin UI should clearly label which print file is recommended for the chosen print lab rather than forcing the owner to guess.

## Item-specific physical parts for the current prototype

Current physical recipe is still prototype/candidate, not production-qualified.

Order-specific quantities should include:

- selected 11x14 deep shadow-box frame;
- one professional luster/satin print;
- one 3 mm black SINTRA artwork panel;
- mounting film;
- N Lumimax LED3FWAW 3 mm flat-top warm-white LEDs;
- N calibrated black PETG StarPods;
- one Raspberry Pi Pico W;
- one Adafruit TLC5947 24-channel constant-current LED driver for current retail N<=24;
- accent-light MOSFET module only if accent lighting remains enabled in the build;
- warm-white COB strip/channel/diffuser only if enabled and validated;
- regulated wall power supply after actual current-budget validation;
- fuse/protection;
- power distribution;
- service connectors;
- harness wire and heat-shrink;
- electronics carrier/standoffs;
- removable rear cover hardware;
- cable-management hardware;
- hanging hardware if required;
- care/setup insert;
- tested shipping packaging.

## Supplier trust vs part/build validation

The admin should stop using one vague "supplier unverified" concept.

Display at least two independent states:

1. **Supplier/source confidence**
   - manufacturer direct;
   - authorized/approved reseller;
   - major reputable electronics/material distributor;
   - reputable specialty retailer;
   - unknown/marketplace seller.

2. **Build validation**
   - researched candidate;
   - bench tested;
   - fit/optical tested;
   - electrically validated;
   - production approved.

A trustworthy supplier does NOT make a part automatically build-validated.

Current reasonably trustworthy source examples verified this turn:
- Adafruit direct for TLC5947 Product 1429 and MOSFET Product 5648;
- Raspberry Pi direct documentation + Raspberry Pi Approved Reseller network for Pico W;
- DigiKey Marketplace listing fulfilled by Lumimax for LED3FWAW, with Lumimax manufacturer datasheet; source is credible but marketplace/fit still needs physical validation;
- Curbell Plastics for genuine 3 mm black SINTRA;
- Drytac technical documentation for MultiTac mounting film.

Avoid generic Amazon marketplace sellers for safety-critical electrical parts unless manufacturer identity/listing/certification can be verified. Amazon may still be suitable for commodity tools/consumables when brand/source is clear.

## Electrical correctness guardrails

Current intended star topology is:
- TLC5947 is a 24-channel constant-current sink;
- Adafruit's TLC5947 breakout is configured around 15 mA/channel;
- LED anodes connect to V+;
- individual LED cathodes connect to TLC5947 OUT0...OUT(N-1);
- Pico W and TLC5947 must share ground;
- TLC5947 control is DIN/CLK/LAT from Pico GPIO;
- 5 V LED supply is appropriate for the ~3.1 V warm-white LED when used through the constant-current driver;
- Pico W VSYS accepts 1.8–5.5 V according to Raspberry Pi documentation, but final shared-supply/USB-programming/backfeed/protection arrangement must be reviewed and tested before production;
- accent COB must be switched through the MOSFET driver, not directly from a Pico GPIO;
- Adafruit MOSFET 5648 switches the load low-side and is rated up to 1.5 A continuous; final accent current must be measured below the validated limit;
- power supply rating, fuse value, wire gauge, connector ratings, thermal behavior and burn-in are still physical test items.

The coding agent must not invent pin numbers or claim an electrical certification. If it adds a wiring diagram/checklist, it must match the actual firmware pin mapping and official board documentation.

The current WS2812 MicroPython demo in `firmware/pico2w/main.py` is obsolete for the TLC5947 architecture and should be shown as a development mismatch/blocker until replaced or reconciled.

## Per-order independent build progress

Every fake/real production job should maintain its own durable checklist keyed to its order/transaction/design ID.

The fake test build should be able to progress independently through:
- order/design verification;
- files ready;
- frame acquired/inspected;
- print ordered/received;
- panel prepared;
- print mounted/inspected;
- star registration/drilling;
- StarPods installed;
- LEDs installed/labeled;
- harness assembled;
- electronics carrier assembled;
- electrical wiring verified;
- firmware/config loaded;
- channel walk;
- dark-room optical QA;
- burn-in;
- final visual/astronomy QA;
- glazing/rear closure;
- QC photos;
- packaging;
- ready to ship TEST state.

This week's goal is to make one synthetic paid-like job usable as a complete physical prototype rehearsal without contaminating the real Etsy payment path.


---

# Latest turn — Immediate files expected after a paid order

For each legitimately paid StarKeepsake order, the owner should immediately have access to the core production files needed to reproduce that exact design:

1. Final customer-approved preview.
2. Original customer image (private recovery/reference).
3. Final processed image/cutout if applicable.
4. Print-ready artwork files:
   - exact 11×14;
   - 1/8-inch bleed;
   - 1/4-inch bleed master.
5. Print specification / trim-safe metadata indicating which file to use for the chosen print lab.
6. Physical-star map / star CSV or JSON with exact N selected stars, LED indices, IDs, magnitudes and print-space coordinates.
7. 1:1 drilling template when geometry validation passes.
8. Frozen maker/build ZIP containing the complete immutable production packet.
9. Order-specific BOM / parts list.
10. Persistent order-specific build/QA checklist.

The owner should not need to reopen the customer builder or regenerate these outputs manually.


---

# Latest turn — Fixed 11x14 is a manufacturing simplification, not a hard product requirement

The user questioned why StarKeepsake must always use an 11x14 frame instead of buying a frame that matches the uploaded image's aspect ratio.

Clarification:

- 11x14 was chosen as a standardized prototype/retail size to simplify print exports, drilling templates, SINTRA panel dimensions, frame sourcing, electronics fit, packaging, pricing, and QA.
- There is no inherent technical requirement that every StarKeepsake be 11x14.
- The more important physical constraint is that the chosen frame must provide enough usable depth and rear access for the artwork panel, StarPods/LEDs, wiring, electronics carrier, power entry, and removable rear cover.
- A future product architecture may support multiple standardized frame sizes/aspect ratios or choose a frame size based on the customer's image aspect ratio.
- If variable frame sizes are supported, the production packet must freeze actual trim width/height, print dimensions, star print-space coordinates, drilling geometry, panel size, and per-order BOM for that specific frame.
- Avoid assuming that a random Amazon frame matching the image aspect ratio is automatically suitable; verify depth, glazing, rabbet/opening, backing, hanger, finish, and service access.
- A practical compromise may be a small supported catalog of standard frame sizes/aspect ratios rather than arbitrary frame dimensions for every order.


---

# Latest turn — Quality review of example manufacturing packet SK-CF00A426C2685565

The user uploaded an example order packet and asked for a quality assessment.

Reviewed artifacts included:
- manufacturing-job-plan.json;
- order.json;
- physical-star-map CSVs;
- 1:1 drilling-template SVG;
- order-sheet PNG;
- exact-11x14 artwork PNG.

Findings:

## Strong / working well
- Manufacturing plan identifies the correct design and reports 9 physical stars, one TLC5947 driver, one connector group, and geometryValidated=true.
- Physical-star CSV contains exactly 9 rows with LED indices 0..8 and print-space X/Y coordinates matching the manufacturing plan.
- Drill template contains the 11x14 nominal rectangle, the same 9 star centers, TOP orientation, a 50 mm verification ruler, and an explicit DRAFT / NOT AUTHORIZED TO DRILL warning.
- Order packet correctly expects the major print variants, print guides/specs, photo-quality report, manufacturing plan, star map, candidate parts, assembly checklist, and drill template.
- Order sheet is visually polished and suitable as a design/Etsy reference card.
- Exact artwork visually looks coherent and premium enough as a concept.

## Important issues / holds
- The order itself is UNPAID_PREVIEW, not a paid production order.
- Manufacturing plan is HOLD_FOR_MANUFACTURING_APPROVAL and explicitly lists unresolved print/star registration, drill-diameter, brightness/PWM, electrical/thermal, Etsy frame-variation, supplier, pricing, and inventory validation.
- This specific example's photo-quality preflight reports effective PPI ~78.79 and warns that the composition stretches the source photograph to the 11x14 print aspect ratio and has insufficient original pixels for the intended printed-photo size. This is a major print-quality blocker.
- The uploaded copy of print-artwork-exact-11x14 received in ChatGPT measured 1609x2048 and contained no PNG pHYs DPI chunk, while order.json declares the intended exact print variant as 3300x4200 at 300 DPI. This could be due to attachment/downsampling in the chat pipeline, so verify the original site-downloaded file locally before treating this as a site-export defect.
- PWM values and aperture categories in the physical-star map remain NOT CALIBRATED.
- Drill SVG is structurally useful but should remain proof/calibration only until a real 100%-scale print-to-panel registration test is completed.

Overall assessment:
- Design/reference output: ~8.5/10.
- Manufacturing data structure: ~8/10.
- Actual print-production readiness for this particular example: ~4/10 because the photo preflight is failing badly.
- Overall packet as a prototype/rehearsal artifact: ~7/10.
- Not yet suitable for real customer fulfillment without resolving the photo fit/PPI issue and the existing physical/electrical validation holds.

Recommended next software priority:
1. Fix the photo compositor so wide source photos are cropped/fit without anisotropic stretching into 11x14 portrait.
2. Treat low effective PPI as an obvious admin/customer production blocker or required owner approval.
3. Verify original downloaded print PNG dimensions/DPI locally.
4. Keep star/drill/electronics calibration holds explicit until physical prototype tests pass.


---

# Latest turn — Variable frame aspect ratio / size instead of fixed 11x14

The user wants StarKeepsake to support different frame aspect ratios/sizes rather than forcing every design into 11x14. The rationale is that the owner can source a corresponding frame for the customer's image instead of distorting/cropping every image into one physical format.

Key architectural correction:

- The selected frame's actual visible opening / trim dimensions should become the manufacturing source of truth.
- Do not equate "matching aspect ratio" with "compatible frame." The selected frame must also have verified internal depth, rabbet/opening, glazing, backing/rear access, hanging hardware, and enough volume for StarPods, wiring, electronics carrier, power entry and serviceability.
- Remove fixed-11x14 assumptions from saved design/manufacturing logic where they represent physical trim, print, star coordinates, drill template, SINTRA panel, BOM and QA.
- Keep 11x14 as one supported size/preset if desired, but not the only allowed geometry.
- Preserve the current retail physical-star cap of 24 unless deliberately changed later; max star count is a product/electronics policy independent of frame size.
- Never stretch the source photo to the frame aspect ratio. Use explicit crop/cover/contain behavior and show the exact customer-visible crop before finalization.
- Effective print PPI must be recalculated from the chosen physical print dimensions, not assumed from 11x14.
- Bleed/safe area must scale from actual trim size; print variants should be generated from actual width/height.
- Physical star print-space coordinates and 1:1 drilling templates must be generated from the frozen actual trim width/height.
- Per-order BOM must use the exact selected frame product/size, panel dimensions, print dimensions, packaging dimensions and any frame-specific spacer/rear-cover requirements.
- The admin order should show the exact frame SKU/link, outer dimensions, visible opening, usable internal depth, trim size, and fit-validation status.
- Prefer a curated catalog of supported, verified frame SKUs/sizes/aspect ratios rather than assuming any random Amazon frame is safe/compatible. The catalog can expand over time.
- Legacy 11x14 designs should remain reproducible and must not be silently remapped.

Current uploaded example showed exactly why this matters: the wide source image was being forced into a portrait 11x14 print, producing a preflight warning for stretching and very low effective PPI. The variable-frame refactor should prevent that class of distortion.


---

# 2026-11-24 — Missing supplier links for admin BOM

Owner supplied a 10-star example order and requested credible supplier links for all No link rows. Research candidates (not production approvals; no purchases made):

- Wall adapter: Adafruit 1466, UL-listed 5V 4A, $14.95 when checked, https://www.adafruit.com/product/1466 . Final load and protection still HOLD.
- Power inlet: Same Sky PJ-011A panel jack 5.5/2.1mm, 5A, https://www.digikey.com/en/products/detail/same-sky-formerly-cui-devices/PJ-011A/305540 ; verify mating, panel thickness, and cable retention.
- Fuse holder: OptiFuse LPC-08B-18R, https://www.digikey.com/en/products/detail/optifuse/LPC-08B-18R/12089489 ; 5x20 holder only, final DC-rated fuse selection HOLD.
- Distribution: two separately isolated WAGO 221-415 connectors for positive/ground, https://www.digikey.com/en/products/detail/wago-corporation/221-415/13549457 ; 24-12 AWG only; secure mechanically, don't insert 26 AWG channel wire.
- 12-channel harness: Molex Micro-Fit 43025-1200 receptacle https://www.digikey.com/en/products/detail/molex/0430251200/252501 ; 43020-1201 plug https://www.newark.com/molex/43020-1201/connector-housing-plug-12pos/dp/56H9388 ; female 43030-0010 https://www.digikey.com/en/products/detail/molex/0430300010/252480 ; male 43031-0010 https://www.digikey.com/en/products/detail/molex/0430310010/252484 . 26-30 AWG terminals; check insulation OD, crimp tool and actual mating/fit. One pair per ceil(N/12), N contacts each gender. Prewired option https://www.commoncables.com/molex-micro-fit-3-0/12-pin .
- Star and accent service connectors: Adafruit 2880 JST SM pair https://www.adafruit.com/product/2880 ; conditional on verified current ratings and mistake-proof keying; do not interchange with star supply or use as main 4A input.
- Main wire prototype candidate 18 AWG stranded copper red/black https://www.jameco.com/z/JMS822-01G-Jameco-ValuePro-18-AWG-6-Color-Stranded-Tinned-Copper-Hook-Up-Wire-Assortment-25-Feet_2206281.html ; final branch wire gauge and terminal fit HOLD.
- Heat shrink Adafruit 344 https://www.adafruit.com/product/344 .
- Nylon standoffs M2.5 https://www.adafruit.com/product/3299 ; M3 if required https://www.adafruit.com/product/4685 .
- Cable tie mounts Gardner Bender MB-20 https://www.homedepot.com/p/205879478 ; validate adhesion/retention.
- Rear cover turn buttons https://framing4yourself.com/product/turn-buttons-and-screws/ ; for wood frames only if fit/strength verified.
- Hangers OOK ReadyScrew D rings https://ookhardware.com/products/readyscrew-d-ring ; size to finished weight/frame strength.
- Packaging Uline artwork/mirror boxes https://www.uline.com/BL_7901/Artwork-Mirror-Boxes ; corners https://www.uline.com/BL_2160/Corrugated-Corner-Protectors ; adapter pouch https://www.uline.com/Product/Detail/S-14761/Bubble-Bags/5-x-8-Self-Seal-Bubble-Bags ; measure actual outer frame and test shipment.
- Continuous warm-white COB candidate BTF-LIGHTING 5V USB FCOB 8mm, https://www.btf-lighting.com/collections/dim-fcob-5v-12v-24v/products/dc5v-usb-fcob-led-light-strip-8mm-pcb-320-leds-fob-cob-ra90-flexible-from-3000k-to-6000k-linear-dimmable ; select 3000K, verify exact rated W/m and bare two-wire tape compatibility; measure full-brightness current. Adafruit 5648 continuous limit 1.5A, don't use PWM as excuse to exceed ratings. Optional short bench sample DFRobot FIT0876 https://www.dfrobot.com/product-2492.html is 60mm, 600mA, with heatsink; not a full perimeter strip.
- Channel/diffuser Diode LED S1 48-inch up to 12mm tape https://www.beeslighting.com/products/diode-led-di-chb-s1-48al-s1-channel-bundle-for-tape-lights-up-to-12mm-48in-classic-frosted-lens-aluminum ; fit/length/thermal proof required.
- Neutral cure black RTV DOWSIL 737 https://www.ellsworth.com/products/by-market/consumer-products/sealants/silicone/dow-737-neutral-cure-sealant-silicone-black-300-ml-cartridge/ ; cure and adhesion coupon required.
- Care card Avery 8387 inkjet matte https://www.avery.com/products/cards/8387 .
- Black 1/8-inch glazing spacer candidate https://www.webpictureframes.com/product4/3296/glass-spacers-picture-frame-supplies-glsspcrblk18.html .
- Pickup/delivery is actual expense, no product link needed.

Important: source confidence is separate from physical qualification. No actual supplier stock/price guarantee, fuse amperage, safety certification of the complete product, or measured frame fit established. No live admin catalog or procurement sheet edited in this turn. Current parts list still has generic frame/print links and 26 AWG category page; can improve later with approved specific SKUs. StarPods 9mm flange means 4.5mm hole spacing isn't necessarily adequate; check real holder footprints and edge clearance before any build.
