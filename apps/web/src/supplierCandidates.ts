/** Manufacturer/distributor listing links verified 2026-11-18.
 * NOT a tested parts list, stock quote, or safety/build approval.
 */
export type SupplierCandidate={
  key:string;supplier:string;url:string;product:string;
  status:'LISTED_NOT_BUILD_VALIDATED';checked:string;notes:string;
  sourceConfidence:'Manufacturer Direct'|'Authorized / Approved Reseller'|
    'Major Reputable Distributor'|'Reputable Specialty Vendor'|
    'Marketplace / Seller Verification Required'|'Unknown — Do Not Purchase';
  buildValidation:'Research Candidate'
}
export const SUPPLIER_CANDIDATES:readonly SupplierCandidate[]=[
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
    notes:'Manufacturer-board source; current, dissipation, proper low-side wiring and accent strip must be measured.'},
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
  {key:'channel_wire',supplier:'DigiKey',
    url:'https://www.digikey.com/en/products/filter/single-conductor-cables-hook-up-wire/474',
    product:'Single-conductor wire catalog',
    notes:'Research category only; 26 AWG stranded wire SKU remains to be chosen.'},
].map(c=>({...c,status:'LISTED_NOT_BUILD_VALIDATED' as const,checked:'2026-11-23' as const,
  sourceConfidence:(
    c.key==='led_driver'||c.key==='accent_mosfet'||c.key==='petg'||c.key==='mount_film'
      ?'Manufacturer Direct':
    c.key==='sintra'||c.key==='star_bus_wire'||c.key==='channel_wire'
      ?'Major Reputable Distributor':
    c.key==='star_led'?'Marketplace / Seller Verification Required':
      'Reputable Specialty Vendor'
  ) as SupplierCandidate['sourceConfidence'],
  buildValidation:'Research Candidate' as const
}))
export const supplierCandidateFor=(key:string)=>
  SUPPLIER_CANDIDATES.find(c=>c.key===key)??null
