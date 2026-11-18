import test from 'node:test'
import assert from 'node:assert/strict'
import {assessPhotoPrintQuality,isExact11x14Artwork}
 from '../src/photoPrintQuality.ts'

const common={artworkWidthMm:279.4,artworkHeightMm:355.6,
 layout:'above',skyHeight:42,photoFit:'fit'}
const grade=(sourceWidth,sourceHeight,settings={})=>
 assessPhotoPrintQuality({...common,sourceWidth,sourceHeight,...settings})

test('standardized physical artboard is exactly eleven by fourteen',()=>{
 assert.equal(isExact11x14Artwork(279.4,355.6),true)
 assert.equal(isExact11x14Artwork(279.4,420),false)
 const outdated=grade(6000,4000,{artworkHeightMm:420})
 assert.equal(outdated.status,'review')
 assert.equal(outdated.needsOwnerReview,true)
 assert.equal(outdated.artworkIs11x14,false)
})
test('effective PPI uses printed PHOTO region, not whole 11x14 canvas',()=>{
 const s=grade(3600,2700)
 assert.equal(s.printedPhotoIn.height,8.12)
 assert.equal(s.status,'excellent')
 assert.ok(s.effectivePpi>=300)
 assert.equal(s.artworkIs11x14,true)
})
test('low-resolution photo requires owner review even if output is 300 DPI',()=>{
 const s=grade(500,400)
 assert.equal(s.status,'review')
 assert.equal(s.needsOwnerReview,true)
 assert.ok(s.effectivePpi<150)
})
test('excellent, good and caution source tiers are independent of export DPI',()=>{
 assert.equal(grade(6000,4000).status,'excellent')
 assert.equal(grade(2300,1700).status,'good')
 assert.equal(grade(1650,1200).status,'caution')
})
test('center crop removes source pixels and worsens effective resolution',()=>{
 const contain=grade(1800,1200,{photoFit:'fit'})
 const crop=grade(1800,1200,{photoFit:'center-crop'})
 assert.ok(crop.effectivePpi<contain.effectivePpi)
 assert.ok(crop.usedSourceCrop.width<1800||crop.usedSourceCrop.height<1200)
})
test('top and bottom crop preserve distinct windows',()=>{
 const top=grade(1200,2000,{photoFit:'top-crop'})
 const bottom=grade(1200,2000,{photoFit:'bottom-crop'})
 assert.notEqual(top.usedSourceCrop.y,bottom.usedSourceCrop.y)
 assert.equal(bottom.usedSourceCrop.y,0)
})
test('full-photo woven mode catches stretch and anisotropic resolution',()=>{
 const s=grade(3600,2700,{layout:'within'})
 assert.equal(s.status,'review')
 assert.ok(s.ppiX>s.ppiY)
 assert.ok(s.warnings.some(x=>x.includes('stretches')))
 const matching=grade(3300,4200,{layout:'within'})
 assert.equal(matching.needsOwnerReview,false)
})
test('a nearly blank image raises a soft detail caution, not an automatic blur verdict',()=>{
 const s=grade(4000,3000,{visual:{
   sampledPixels:1500,lumaStdDev:3,laplacianVariance:1,
   darkPercent:0,lightPercent:0
 }})
 assert.equal(s.needsOwnerReview,false)
 assert.ok(s.warnings.some(x=>x.includes('very little high-frequency')))
})
test('invalid source and geometry fail instead of returning misleading PASS',()=>{
 assert.throws(()=>grade(0,1000),/Invalid/)
 assert.throws(()=>grade(4000,3000,{skyHeight:110}),/Invalid/)
})
