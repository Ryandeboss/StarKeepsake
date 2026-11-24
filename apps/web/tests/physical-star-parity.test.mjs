import test from 'node:test'
import assert from 'node:assert/strict'
import {selectVisiblePhysicalStars} from '../src/physicalStarSelection.ts'
import {countPhysicalLeds,assertMakerStarParity,assertManifestStarParity}
  from '../src/physicalStarParity.ts'

const candidate=(id,x,y)=>({
  star:{hipparcosId:id,ledIndex:-1,xMm:x,yMm:y,
    magnitude:2+(id%7)*.2,altitudeDeg:40,azimuthDeg:id*7,holeSizeMm:1.2},
  printXMm:x,printYMm:y
})
test('18 visible stars can produce 13 physical LEDs when 5 are too close',()=>{
  const first=Array.from({length:13},(_,i)=>candidate(
    i+1,12+(i%5)*40,18+Math.floor(i/5)*45))
  const five=Array.from({length:5},(_,i)=>candidate(
    101+i,first[i].printXMm+.6,first[i].printYMm+.5))
  const selected=selectVisiblePhysicalStars([...first,...five],24,4.5)
  assert.equal(selected.physicalSelection.eligibleStars,18)
  assert.equal(selected.physicalSelection.selectedStars,13)
  assert.equal(selected.physicalStars.length,13)
  assert.equal(selected.tooClose,5)
  const design={physicalStars:selected.physicalStars,
    physicalSelection:selected.physicalSelection}
  assert.equal(countPhysicalLeds(design),13)
  const maker={physicalCount:13,
    stars:selected.physicalStars.map(s=>({
      ledIndex:s.ledIndex,hipparcosId:s.hipparcosId}))}
  assert.equal(assertMakerStarParity(design,maker,13),13)
  const manifest={design,
    manufacturing:{selectedPhysicalStars:13,candidatePlan:{physicalCount:13}}}
  assert.equal(assertManifestStarParity(manifest),13)
  assert.throws(()=>assertMakerStarParity(design,{...maker,physicalCount:18},13),
    /Physical star count/)
  assert.throws(()=>assertManifestStarParity({
    ...manifest,manufacturing:{...manifest.manufacturing,
      selectedPhysicalStars:18}}),/physical LED count/i)
})
test('18 safely spaced candidates remain 18 in both customer and maker totals',()=>{
  const candidates=Array.from({length:18},(_,i)=>
    candidate(i+1,10+(i%6)*40,12+Math.floor(i/6)*55))
  const selection=selectVisiblePhysicalStars(candidates,24,4.5)
  assert.equal(selection.physicalStars.length,18)
  const design={physicalStars:selection.physicalStars,
    physicalSelection:selection.physicalSelection}
  const maker={physicalCount:18,
    stars:selection.physicalStars.map(s=>({
      ledIndex:s.ledIndex,hipparcosId:s.hipparcosId}))}
  assert.equal(countPhysicalLeds(design),18)
  assert.equal(assertMakerStarParity(design,maker,18),18)
})
test('never quietly freeze a different set, even if counts coincide',()=>{
  const selection=selectVisiblePhysicalStars([
    candidate(1,16,18),candidate(2,76,88)],24)
  const design={physicalStars:selection.physicalStars,
    physicalSelection:selection.physicalSelection}
  const maker={physicalCount:2,stars:[
    {ledIndex:0,hipparcosId:1},{ledIndex:1,hipparcosId:2}]}
  assert.equal(assertMakerStarParity(design,maker,2),2)
  assert.throws(()=>assertMakerStarParity(design,{
    ...maker,stars:[...maker.stars.slice(0,1),{ledIndex:1,hipparcosId:999}]
  },2),/identities changed/)
  assert.throws(()=>countPhysicalLeds({
    ...design,physicalSelection:{...design.physicalSelection,selectedStars:3}
  }),/Selected physical-star count/)
  assert.throws(()=>countPhysicalLeds({
    ...design,physicalStars:[design.physicalStars[0],design.physicalStars[0]]
  }),/numbering changed/)
})
