/**
 * Public manufacturer/distributor pages checked 2026-11-18.
 * "Listing verified" is NOT a purchasing approval, inventory assertion,
 * validated electrical design, or a guarantee of price/availability.
 */
export type SupplierCandidate={
  key:string;supplier:string;url:string;product:string;
  listingStatus:'LISTING_VERIFIED_COMPATIBILITY_HOLD';
  checkedDate:'2026-11-18';notes:string
}
const checkedDate='2026-11-18' as const
export const VERIFIED_LISTING_CANDIDATES:readonly SupplierCandidate[]=[
  {key:'star_led',supplier:'DigiKey Marketplace',
    url:'https://www.digikey.com/en/products/detail/lumimax-optoelectronic-technology/LED3FWAW/29263570',
    product:'Lumimax LED3FWAW',notes:'Exact model listing. Confirm current, polarity, optical output, lead mounting and suitability.'},
  {key:'led_driver',supplier:'Adafruit',
    url:'https://www.adafruit.com/product/1429',
    product:'Adafruit TLC5947 24-channel PWM breakout',
    notes:'Real 24-channel 12-bit PWM board. Board dimensions, output currents and multi-board design remain unqualified.'},
  {key:'pico',supplier:'Adafruit',
    url:'https://www.adafruit.com/product/5526',
    product:'Raspberry Pi Pico W',
    notes:'Pico W (without headers); note two already on hand per owner report, but not booked to inventory.'},
  {key:'frame',supplier:'CustomPictureFrames.com',
    url:'https://www.custompictureframes.com/shadow-box-frames/sizes/11x14',
    product:'11Ã—14 deep shadow-box frame catalog',
    notes:'Catego¶»§q«^