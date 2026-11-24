/** Manufacturer/distributor listing research (legacy 2026-11-23, additions 2026-11-24).
 * NOT a tested parts list, stock quote, or safety/build approval.
 */
export type SupplierCandidate={
  sku:string;manufacturer:string;mpn:string;category:string;unit:string;
  key:string;supplier:string;url:string;product:string;
  status:'LISTED_NOT_BUILD_VALIDATED';checked:string;notes:string;
  sourceConfidence:'Manufacturer Direct'|'Authorized / Approved Reseller'|
    'Major Reputable Distributor'|'Reputable Specialty Vendor'|
    'Marketplace / Seller Verification Required'|'Unknown — Do Not Purchase';
  buildValidation:'Research Candidate'
}
const LEGACY_CANDIDATES=[
  {key:'star_led',supplier:'DigiKey Marketplace',
    url:'https://www.digikey.com/en/products/detail/lumimax-optoelectronic-technology/LED3FWAW/29263570',
    product:'Lumimax LED3FWAW',
    notes:'Exact part listing. Test intensity, polarity, current, mounting and lead routing.'},
  {key:'led_driver',supplier:'Adafruit',
    url:'https://www.adafruit.com/product/1429',
    product:'TLC5947 24-channel PWM breakout',
    notes:'24-channel board listing. Multi-board wiring, current and Pico W firmware unqualified.'},
  {key:'accent_mosfet',supplier:'Adafruit',
    url:'https://www.adafruit.com/product/5648',
    product:'Adafruit MOSFET Driver Product 5648',
    notes:'Manufacturer-board source; 1.5 A continuous limit; current, dissipation, low-side wiring and accent strip must be measured.'},
  {key:'pico',supplier:'Adafruit',
    url:'https://www.adafruit.com/product/5526',
    product:'Raspberry Pi Pico W',
    notes:'Pico W catalog listing. Existing personal boards are not booked as M3 inventory.'},
  {key:'frame',supplier:'CustomPictureFrames.com',
    url:'https://www.custompictureframes.com/shadow-box-frames/sizes/11x14',
    product:'11x14 shadowbox frame catalog',
    notes:'Category selection, NOT an exact match for selected walnut/ebony finish, depth or electrical cavity.'},
  {key:'professional_print',supplier:'Nations Photo Lab',
    url:'https://www.nationsphotolab.com/products/prints-11x14',
    product:'11x14 professional photo print',
    notes:'Confirm luster/satin stock, trim behavior and accepted exact/1/8/1/4 bleed.'},
  {key:'sintra',supplier:'Curbell Plastics',
    url:'https://www.curbellplastics.com/product/w01-01027/',
    product:'Genuine SINTRA black expanded PVC sheet, 3 mm',
    notes:'Distributor listing verified; order sheet larger than 11x14. Mechanical cut/drill ONLY — never laser PVC.'},
  {key:'mount_film',supplier:'Drytac (manufacturer reference)',
    url:'https://www.drytac.com/product/multitachightack/',
    product:'Drytac MultiTac White pressure-sensitive mounting film',
    notes:'Manufacturer data describes SINTRA substrates. A seller, correct roll width, adhesion and print compatibility still require testing.'},
  {key:'petg',supplier:'Polymaker',
    url:'https://shop.polymaker.com/products/petg',
    product:'Polymaker PETG filament',
    notes:'PolyLite PETG is being discontinued. Choose a tested black 1.75mm spool after verifying printer, enclosure and pod geometry.'},
  {key:'star_bus_wire',supplier:'DigiKey',
    url:'https://www.digikey.com/en/products/detail/belden-inc/83026-010100/7388982',
    product:'Belden 83026 010100 hook-up wire',
    notes:'Listing found; verify gauge, insulation, ampacity and harness length.'},
].map(c=>({...c,status:'LISTED_NOT_BUILD_VALIDATED' as const,checked:'2026-11-23' as const,
  sourceConfidence:(
    c.key==='led_driver'||c.key==='accent_mosfet'||c.key==='petg'||c.key==='mount_film'
      ?'Manufacturer Direct':
    c.key==='sintra'||c.key==='star_bus_wire'
      ?'Major Reputable Distributor':
    c.key==='star_led'?'Marketplace / Seller Verification Required':
      'Reputable Specialty Vendor'
  ) as SupplierCandidate['sourceConfidence'],
  buildValidation:'Research Candidate' as const
}))
const LEGACY_META:Record<string,[string,string,string,string,string]>={"star_led":["LED3FWAW","Lumimax","LED3FWAW","lighting","each"],"led_driver":["TLC5947","Adafruit","1429","electronics","each"],"accent_mosfet":["MOSFET-5648","Adafruit","5648","electronics","each"],"pico":["PICO-W","Raspberry Pi","Pico W","electronics","each"],"frame":["FRAME-SHADOWBOX","Custom Picture Frames","","frame","each"],"professional_print":["PHOTO-PRINT","Nations Photo Lab","","photo","each"],"sintra":["SINTRA-3MM-BLACK","SINTRA","","mounting","sheet"],"mount_film":["DRYTAC-MULTITAC","Drytac","MultiTac White","mounting","sheet"],"petg":["PETG-BLACK","Polymaker","","consumable","each"],"star_bus_wire":["BELDEN-83026","Belden","83026-010100","electronics","m"]}
const RESEARCH_CANDIDATES=[
  {
    "key": "wall_power",
    "sku": "POWER-5V4A",
    "manufacturer": "Adafruit",
    "mpn": "1466",
    "supplier": "Adafruit",
    "product": "5V 4A regulated power adapter",
    "url": "https://www.adafruit.com/product/1466",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Manufacturer Direct",
    "notes": "Verify load, thermal limits and certification; 5.5 × 2.1 mm center-positive plug."
  },
  {
    "key": "power_entry",
    "sku": "DC-JACK-PJ011A",
    "manufacturer": "Same Sky",
    "mpn": "PJ-011A",
    "supplier": "DigiKey",
    "product": "PJ-011A panel DC jack",
    "url": "https://www.digikey.com/en/products/detail/same-sky-formerly-cui-devices/PJ-011A/305540",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Major Reputable Distributor",
    "notes": "Confirm 5.5 × 2.1 mm adapter mating, mounting, current and separate strain relief."
  },
  {
    "key": "fuse",
    "sku": "FUSE-HOLDER-LPC08B",
    "manufacturer": "OptiFuse",
    "mpn": "LPC-08B-18R",
    "supplier": "DigiKey Marketplace",
    "product": "LPC-08B-18R inline fuse holder",
    "url": "https://www.digikey.com/en/products/detail/optifuse/LPC-08B-18R/12089489",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Marketplace / Seller Verification Required",
    "notes": "Holder only; select DC-rated fuse and validate protection before use."
  },
  {
    "key": "distribution",
    "sku": "WAGO-221-415",
    "manufacturer": "WAGO",
    "mpn": "221-415",
    "supplier": "DigiKey",
    "product": "WAGO 221-415 lever connector",
    "url": "https://www.digikey.com/en/products/detail/wago-corporation/221-415/13549457",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Major Reputable Distributor",
    "notes": "Two connectors per frame, positive and ground. Verify wire gauge; not for undersized star wires."
  },
  {
    "key": "star_service",
    "sku": "JST-SM-2PIN",
    "manufacturer": "Adafruit",
    "mpn": "2880",
    "supplier": "Adafruit",
    "product": "2-pin JST SM connector pair",
    "url": "https://www.adafruit.com/product/2880",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Verify current and polarity; avoid interchangeable star/accent connectors."
  },
  {
    "key": "accent_service",
    "sku": "JST-SM-2PIN",
    "manufacturer": "Adafruit",
    "mpn": "2880",
    "supplier": "Adafruit",
    "product": "2-pin JST SM connector pair",
    "url": "https://www.adafruit.com/product/2880",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Candidate only; distinct keying or other prevention of incorrect connections required."
  },
  {
    "key": "main_wire",
    "sku": "WIRE-18AWG-JMS822",
    "manufacturer": "Jameco ValuePro",
    "mpn": "JMS822-01G",
    "supplier": "Jameco",
    "product": "18 AWG stranded copper wire assortment",
    "url": "https://www.jameco.com/z/JMS822-01G-Jameco-ValuePro-18-AWG-6-Color-Stranded-Tinned-Copper-Hook-Up-Wire-Assortment-25-Feet_2206281.html",
    "category": "electronics",
    "unit": "m",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Final gauge, current rating, cut length and routing require validation."
  },
  {
    "key": "heat_shrink",
    "sku": "HEAT-SHRINK-344",
    "manufacturer": "Adafruit",
    "mpn": "344",
    "supplier": "Adafruit",
    "product": "Assorted heat-shrink pack",
    "url": "https://www.adafruit.com/product/344",
    "category": "consumable",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Select tubing size and measure total usage after harness mockup."
  },
  {
    "key": "harness_groups",
    "sku": "MICROFIT-12-ASSEMBLED",
    "manufacturer": "Common Cables",
    "mpn": "12-pin custom assembly",
    "supplier": "Common Cables",
    "product": "Micro-Fit 3.0 12-pin preassembled harness alternative",
    "url": "https://www.commoncables.com/molex-micro-fit-3-0/12-pin",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Alternative to individual housings and terminals, not an additional required purchase. Verify pinout, tooling and length."
  },
  {
    "key": "channel_wire",
    "sku": "WIRE-26AWG-3002582",
    "manufacturer": "Tensility",
    "mpn": "30-02582",
    "supplier": "DigiKey",
    "product": "26 AWG stranded FEP black wire",
    "url": "https://www.digikey.com/en/products/detail/tensility-international-corp/30-02582/16731884",
    "category": "electronics",
    "unit": "m",
    "sourceConfidence": "Major Reputable Distributor",
    "notes": "Listed 1.14 mm OD fits nominal 1.27 mm terminal limit; check tolerance and crimp pull test. Replaces Adafruit 2517 (1.5 mm OD)."
  },
  {
    "key": "mounting_hardware",
    "sku": "NYLON-M25-3299",
    "manufacturer": "Adafruit",
    "mpn": "3299",
    "supplier": "Adafruit",
    "product": "M2.5 nylon hardware kit",
    "url": "https://www.adafruit.com/product/3299",
    "category": "mounting",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Choose M2.5 or M3 only after checking board hole dimensions."
  },
  {
    "key": "wire_management",
    "sku": "GB-MB20",
    "manufacturer": "Gardner Bender",
    "mpn": "MB-20",
    "supplier": "Home Depot",
    "product": "Gardner Bender mounting bases",
    "url": "https://www.homedepot.com/p/205879478",
    "category": "mounting",
    "unit": "each",
    "sourceConfidence": "Major Reputable Distributor",
    "notes": "Measure mounting count; validate adhesive and routing."
  },
  {
    "key": "rear_closure",
    "sku": "FRAME-TURN-BUTTONS",
    "manufacturer": "Framing 4 Yourself",
    "mpn": "",
    "supplier": "Framing 4 Yourself",
    "product": "Turn buttons and screws",
    "url": "https://framing4yourself.com/product/turn-buttons-and-screws/",
    "category": "mounting",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Measure required fasteners and rear service access."
  },
  {
    "key": "hanger_upgrade",
    "sku": "OOK-D-RING",
    "manufacturer": "OOK",
    "mpn": "",
    "supplier": "OOK",
    "product": "ReadyScrew D-Ring hangers",
    "url": "https://ookhardware.com/products/readyscrew-d-ring",
    "category": "mounting",
    "unit": "each",
    "sourceConfidence": "Manufacturer Direct",
    "notes": "Select weight rating and verify actual frame material."
  },
  {
    "key": "spacer_stock",
    "sku": "FRAMETEK-SPACER-18",
    "manufacturer": "FrameTek",
    "mpn": "",
    "supplier": "Web Picture Frames",
    "product": "Black 1/8-inch glazing spacers",
    "url": "https://www.webpictureframes.com/product4/3296/glass-spacers-picture-frame-supplies-glsspcrblk18.html",
    "category": "mounting",
    "unit": "m",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Measure glazing clearance; only if required."
  },
  {
    "key": "rtv",
    "sku": "DOWSIL-737-BLACK",
    "manufacturer": "Dow",
    "mpn": "737",
    "supplier": "Ellsworth Adhesives",
    "product": "DOWSIL 737 black neutral-cure silicone",
    "url": "https://www.ellsworth.com/products/by-market/consumer-products/sealants/silicone/dow-737-neutral-cure-sealant-silicone-black-300-ml-cartridge/",
    "category": "consumable",
    "unit": "ml",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Test cure, PETG/SINTRA adhesion and electronics compatibility."
  },
  {
    "key": "accent_cob",
    "sku": "BTF-5V-COB-3000K",
    "manufacturer": "BTF-LIGHTING",
    "mpn": "",
    "supplier": "BTF-LIGHTING",
    "product": "5V FCOB strip, select 3000K",
    "url": "https://www.btf-lighting.com/collections/dim-fcob-5v-12v-24v/products/dc5v-usb-fcob-led-light-strip-8mm-pcb-320-leds-fob-cob-ra90-flexible-from-3000k-to-6000k-linear-dimmable",
    "category": "lighting",
    "unit": "m",
    "sourceConfidence": "Manufacturer Direct",
    "notes": "Measure length/current, cut points and two-wire compatibility. Adafruit 5648 continuous limit 1.5 A; test thermal budget."
  },
  {
    "key": "accent_channel",
    "sku": "DIODE-S1-48AL",
    "manufacturer": "Diode LED",
    "mpn": "DI-CHB-S1-48AL",
    "supplier": "Bees Lighting",
    "product": "S1 48-inch channel and frosted lens",
    "url": "https://www.beeslighting.com/products/diode-led-di-chb-s1-48al-s1-channel-bundle-for-tape-lights-up-to-12mm-48in-classic-frosted-lens-aluminum",
    "category": "lighting",
    "unit": "m",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Measure installed length, fit and diffusion."
  },
  {
    "key": "shipping",
    "sku": "ULINE-ARTWORK-BOX",
    "manufacturer": "Uline",
    "mpn": "",
    "supplier": "Uline",
    "product": "Artwork/mirror box category",
    "url": "https://www.uline.com/BL_7901/Artwork-Mirror-Boxes",
    "category": "packaging",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Select box to measured exterior dimensions and depth; drop test complete package."
  },
  {
    "key": "instruction_stock",
    "sku": "AVERY-8387",
    "manufacturer": "Avery",
    "mpn": "8387",
    "supplier": "Avery",
    "product": "Avery matte printable postcards",
    "url": "https://www.avery.com/products/cards/8387",
    "category": "packaging",
    "unit": "sheet",
    "sourceConfidence": "Manufacturer Direct",
    "notes": "One finished care insert per order; verify instructions and sheet yield."
  }
] as const
const ASSEMBLY_CANDIDATES=[
  {
    "key": "harness_groups",
    "sku": "MICROFIT-43025-1200",
    "manufacturer": "Molex",
    "mpn": "43025-1200",
    "supplier": "Molex",
    "product": "12-position receptacle housing",
    "url": "https://www.molex.com/en-us/products/part-detail/0430251200",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Manufacturer Direct",
    "notes": "Verify mating, pinout and tooling.",
    "quantityRule": "groups"
  },
  {
    "key": "harness_groups",
    "sku": "MICROFIT-43020-1201",
    "manufacturer": "Molex",
    "mpn": "43020-1201",
    "supplier": "Newark",
    "product": "12-position plug housing",
    "url": "https://www.newark.com/molex/43020-1201/connector-housing-plug-12pos/dp/56H9388",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Major Reputable Distributor",
    "notes": "Verify mating, pinout and tooling.",
    "quantityRule": "groups"
  },
  {
    "key": "harness_groups",
    "sku": "MICROFIT-43030-0010",
    "manufacturer": "Molex",
    "mpn": "43030-0010",
    "supplier": "Molex",
    "product": "Female crimp terminals",
    "url": "https://www.molex.com/en-us/products/part-detail/430300010",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Manufacturer Direct",
    "notes": "26–30 AWG; 1.27 mm max insulation; verify crimp tooling.",
    "quantityRule": "stars"
  },
  {
    "key": "harness_groups",
    "sku": "MICROFIT-43031-0010",
    "manufacturer": "Molex",
    "mpn": "43031-0010",
    "supplier": "Molex",
    "product": "Male crimp terminals",
    "url": "https://www.molex.com/en-us/products/part-detail/430310010",
    "category": "electronics",
    "unit": "each",
    "sourceConfidence": "Manufacturer Direct",
    "notes": "26–30 AWG; 1.27 mm max insulation; verify crimp tooling.",
    "quantityRule": "stars"
  },
  {
    "key": "mounting_hardware",
    "sku": "NYLON-M3-4685",
    "manufacturer": "Adafruit",
    "mpn": "4685",
    "supplier": "Adafruit",
    "product": "M3 nylon hardware kit (alternative)",
    "url": "https://www.adafruit.com/product/4685",
    "category": "mounting",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Alternative; measure board holes.",
    "quantityRule": "alternative"
  },
  {
    "key": "shipping",
    "sku": "ULINE-CORNERS",
    "manufacturer": "Uline",
    "mpn": "",
    "supplier": "Uline",
    "product": "Corrugated corner protectors",
    "url": "https://www.uline.com/BL_2160/Corrugated-Corner-Protectors",
    "category": "packaging",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Select size and quantity after packaging proof.",
    "quantityRule": "measure"
  },
  {
    "key": "shipping",
    "sku": "ULINE-S14761",
    "manufacturer": "Uline",
    "mpn": "S-14761",
    "supplier": "Uline",
    "product": "Power adapter bubble pouch",
    "url": "https://www.uline.com/Product/Detail/S-14761/Bubble-Bags/5-x-8-Self-Seal-Bubble-Bags",
    "category": "packaging",
    "unit": "each",
    "sourceConfidence": "Reputable Specialty Vendor",
    "notes": "Confirm adapter fits and is protected.",
    "quantityRule": "one"
  }
] as const
type CandidateInput=Omit<SupplierCandidate,'status'|'checked'|'buildValidation'>
const research=(c:CandidateInput):SupplierCandidate=>({...c,status:'LISTED_NOT_BUILD_VALIDATED',checked:'2026-11-24',buildValidation:'Research Candidate'})
export const SUPPLIER_CANDIDATES:readonly SupplierCandidate[]=[
  ...LEGACY_CANDIDATES.map(c=>{
    const [sku,manufacturer,mpn,category,unit]=LEGACY_META[c.key]
    return {...c,sku,manufacturer,mpn,category,unit}
  }),
  ...RESEARCH_CANDIDATES.map(research)
]
export type AssemblyCandidate=SupplierCandidate & {quantityRule:'groups'|'stars'|'measure'|'one'|'alternative'}
export const SUPPLIER_COMPONENTS:readonly AssemblyCandidate[]=ASSEMBLY_CANDIDATES.map(c=>({...research(c),quantityRule:c.quantityRule}))
export const supplierCandidateFor=(key:string)=>SUPPLIER_CANDIDATES.find(c=>c.key===key)??null
export const supplierSkuFor=(key:string,skuHint?:string|null)=>skuHint||supplierCandidateFor(key)?.sku||null
type CatalogPart={sku:string;supplier_url:string|null;notes?:string|null}
export function resolveSupplierLink(sku:string|null,candidate:SupplierCandidate|null,materials:readonly CatalogPart[]=[]){
  const valid=(url:string|null|undefined)=>/^https:\/\/[^\s]+$/i.test(url||'')?url!:null
  const saved=sku?materials.find(p=>p.sku.toUpperCase()===sku.toUpperCase()):undefined
  return valid(saved?.supplier_url)||valid(candidate?.url)
}
export function assemblyQuantity(rule:AssemblyCandidate['quantityRule'],groups:number|null,stars:number|null){
  return rule==='groups'?groups:rule==='stars'?stars:rule==='one'?1:null
}

