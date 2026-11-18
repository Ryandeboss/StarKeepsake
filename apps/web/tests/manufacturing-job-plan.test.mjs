import test from 'node:test'
import assert from 'node:assert/strict'
import {buildManufacturingJobPlan,makerChecklistJson, makerPartsCsv,
 makerStarMapCsv,makerDrillTemplateSvg} from '../src/manufacturingJobPlan.ts'

const prefs={layout:'above',heading:180,pitch:18,fov:105,skyHeight:42,
 photoFit:'fit',tone:'natural',glow:true,finish:'walnut',inscription:'Test moment'}
function fixture(n,options={}){
 const stars=Array.from({length:n},(_,i)=>({
   ledIndex:i,hipparcosId:10000+i,magnitude:2.3,
   printXMm:8+(i%10)*24,printYMm:8+Math.floor(i/10)*24,
   holeSizeMm:0.8,selectionReason:'view_auto',
 }))
 const design={designId:'SK-0123456789ABCDEF',schemaVersion:'1.5',
   physicalArtwork:{widthMm:279.4,heightMm:355.6},
   moment:{date:'2024-07-04',time:'21:00',location:{displayName:'Chicago'}},
   astronomy:{catalog:'hipparcos',ephemeris:'de440s'},
   physicalStars:stars,physicalSelection:{maxPhysicalStars:72,
      selectedStars:n,minSeparationMm:4.5},
   ...options}
 return buildManufacturingJobPlan(design,prefs)
}
const row=(plan,key)=>plan.parts.find(x=>x.key===key)
test('a real paid job with N=12 yields 12 LEDs and one driver, one harness group',()=>{
 const x=fixture(12)
 assert.equal(x.geometryValidated,true)
 assert.equal(x.physicalCount,12)
 assert.equal(row(x,'star_led').quantity,12)
 assert.equal(row(x,'starpods').quantity,12)
 assert.equal(row(x,'led_driver').quantity,1)
 assert.equal(row(x,'harness_groups').quantity,1)
 assert.equal(row(x,'channel_wire').quantity,12)
 assert.equal(row(x,'frame').quantity,1)
 assert.equal(row(x,'pico').quantity,1)
 assert.equal(x.status,'HOLD_FOR_MANUFACTURING_APPROVAL')
})
test('N is not capped by a single TLC5947 board',()=>{
 for(const [n,drivers,groups] of [[24,1,2],[36,2,3],[49,3,5],[72,3,6]]){
   const x=fixture(n)
   assert.equal(x.physicalCount,n)
   assert.equal(x.driverCount,drivers)
   assert.equal(x.connectorGroupCount,groups)
   assert.equal(row(x,'star_led').quantity,n)
   assert.equal(row(x,'starpods').quantity,n)
 }
})
test('all four owner parts sections appear with quantities or explicit TBD',()=>{
 const x=fixture(18)
 assert.deepEqual([...new Set(x.parts.map(p=>p.group))],['buy','pack','bulk','make'])
 assert.equal(row(x,'petg').quantity,null)
 assert.equal(row(x,'wall_power').review,'HOLD')
 assert.equal(row(x,'professional_print').quantity,1)
 assert.match(makerPartsCsv(x),/SOURCE_AND_VERIFY/)
 assert.match(makerPartsCsv(x),/TO MEASURE/)
 assert.ok(x.parts.length>=30)
 assert.equal(x.steps.length,23)
 assert.match(makerChecklistJson(x),/No durable server-side completion/)
})
test('frozen distinct LED coordinates produce a scale-labeled front-facing SVG',()=>{
 const x=fixture(36)
 const svg=makerDrillTemplateSvg(x)
 assert.match(svg,/TOP ↑ FRONT VIEW/)
 assert.match(svg,/PRINT 100%/)
 assert.match(svg,/width="303.4mm"/)
 assert.match(svg,/NOT AUTHORIZED/)
 assert.match(makerStarMapCsv(x),/LED INDEX,HIP ID/)
 assert.equal(x.stars.length,36)
})
test('missing physical star set or unregistered coordinates BLOCK drilling',()=>{
 const absent=fixture(0)
 assert.equal(absent.geometryValidated,false)
 assert.throws(()=>makerDrillTemplateSvg(absent),/held/)
 const missing=fixture(12)
 missing.stars[0].printXMm=null
 missing.geometryValidated=false
 assert.throws(()=>makerDrillTemplateSvg(missing),/held/)
 const bad=fixture(3,{physicalStars:[{
    ledIndex:0,hipparcosId:1,magnitude:1,printXMm:10,
    printYMm:10,holeSizeMm:.8,selectionReason:'view_auto'},
   {ledIndex:0,hipparcosId:2,magnitude:2,printXMm:30,
    printYMm:30,holeSizeMm:.8,selectionReason:'view_auto'}],
    physicalSelection:{maxPhysicalStars:72,selectedStars:2,minSeparationMm:4.5}})
 assert.equal(bad.geometryValidated,false)
})
test('legacy non-11x14 design is never silently approved',()=>{
 const x=fixture(10,{physicalArtwork:{widthMm:279.4,heightMm:400}})
 assert.ok(x.holds.some(s=>s.includes('not the required 11')))
 assert.equal(x.geometryValidated,false)
 assert.throws(()=>makerDrillTemplateSvg(x),/held/)
 assert.equal(x.status,'HOLD_FOR_MANUFACTURING_APPROVAL')
})
