/** Manufacturer/distributor listing links verified 2026-11-18.
 * NOT a tested parts list, stock quote, or safety/build approval.
 */
export type SupplierCandidate={
  key:string;supplier:string;url:string;product:string;
  status:'LISTED_NOT_BUILD_VALIDATED';checked:'2026-11-18';notes:string
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
  {key:'sintra',supplier:'MakerStock',
    url:'https://makerstock.com/products/expanded-pvc-foam-black',
    product:'Black expanded PVC sheet',
    notes:'Confirm 3mm thickness and purchase sheet larger than the final 11x14 cut.'},
  {key:'mount_film',supplier:'Grainger',
    url:'https://www.grainger.com/product/3M-Transfer-Tape-12-in-Wd-24WG66',
    product:'3M 467MP 12-inch transfer tape',
    notes:'Unqualified adhesion compatibility with luster paper and PVC; physical flatness test needed.'},
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
].map(c=>({...c,status:'LISTED_NOT_BUILD_VALIDATED' as const,checked:'2026-11-18' as const}))
export const supplierCandidateFor=(key:string)=>
  SUPPLIER_CANDIDATES.find(c=>c.key===key)??null
