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
