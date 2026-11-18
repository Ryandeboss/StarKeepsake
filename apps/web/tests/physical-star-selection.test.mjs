import test from 'node:test'
import assert from 'node:assert/strict'
import {selectVisiblePhysicalStars,physicalToggleError,DEFAULT_MAX_PHYSICAL_STARS}
  from '../src/physicalStarSelection.ts'
const candidate=(id,x,y,mag=3)=>({
  star:{hipparcosId:id,xMm:x/2,yMm:y/2,altitudeDeg:50,
    azimuthDeg:id%360,magnitude:mag,holeSizeMm:1.2,ledIndex:-1},
  printXMm:x,printYMm:y,
})
const spaced=(n)=>Array.from({length:n},(_,i)=>
  candidate(i+1,14+(i%8)*30,16+Math.floor(i/8)*32,(i%8)*.25))

test('all 12 and all 24 safely spaced visible stars receive LEDs automatically',()=>{
  for(const n of [12,24]){
    const result=selectVisiblePhysicalStars(spaced(n),DEFAULT_MAX_PHYSICAL_STARS)
    assert.equal(result.physicalStars.length,n)
    assert.deepEqual(result.physicalStars.map(s=>s.hipparcosId),
      spaced(n).map(s=>s.star.hipparcosId).sort((a,b)=>
        spaced(n)[a-1].star.magnitude-spaced(n)[b-1].star.magnitude||a-b))
    assert.deepEqual(result.physicalStars.map(s=>s.ledIndex),
      Array.from({length:n},(_,i)=>i))
  }
})
test('busy sky prefers bright, distributes and caps at configured maximum',()=>{
  const packed=Array.from({length:24},(_,i)=>candidate(i+1,40+i*.1,40+i*.1,-1+i*.05))
  const spread=Array.from({length:36},(_,i)=>
    candidate(100+i,20+(i%9)*25,65+Math.floor(i/9)*27,1.8+i*.01))
  const all=packed.concat(spread)
  const a=selectVisiblePhysicalStars(all,24,4.5)
  const b=selectVisiblePhysicalStars([...all].reverse(),24,4.5)
  const selected=a.physicalStars.map(s=>s.hipparcosId)
  assert.equal(selected.length,24)
  assert.ok(selected.includes(1),'brightest original anchor retained')
  assert.ok(selected.some(id=>id>=100),'distributed stars also selected')
  assert.deepEqual(selected,b.physicalStars.map(s=>s.hipparcosId),'input order independent')
  assert.deepEqual(a.physicalStars.map(s=>s.ledIndex),
    Array.from({length:24},(_,i)=>i))
  assert.ok(a.physicalStars.every(s=>s.printXMm!==undefined&&s.printYMm!==undefined))
  assert.equal(a.physicalSelection.estimatedDriverCount,1)
})
test('manual mode persists exact checked stars; off stars remain digitally available',()=>{
  const all=spaced(31)
  const automatic=selectVisiblePhysicalStars(all,24)
  const manualIds=automatic.physicalStars.map(s=>s.hipparcosId).slice(0,23)
  const different=all.find(c=>!manualIds.includes(c.star.hipparcosId)&&
    !automatic.physicalStars.some(s=>s.hipparcosId===c.star.hipparcosId))
  assert.ok(different)
  manualIds.push(different.star.hipparcosId)
  const custom=selectVisiblePhysicalStars(all,24,4.5,{mode:'manual',selectedHipIds:manualIds})
  assert.deepEqual(custom.physicalStars.map(s=>s.hipparcosId),manualIds)
  assert.ok(custom.physicalStars.every(s=>s.selectionReason==='view_manual'))
  const fewer=selectVisiblePhysicalStars(all,24,4.5,
    {mode:'manual',selectedHipIds:manualIds.slice(0,12)})
  assert.equal(fewer.physicalStars.length,12)
  const onlyVisible=selectVisiblePhysicalStars(all.slice(0,12),24,4.5,
    {mode:'manual',selectedHipIds:manualIds})
  assert.ok(onlyVisible.physicalStars.length<=12)
})
test('invalid manual choices cannot exceed cap or violate physical spacing',()=>{
  const stars=[candidate(1,50,50,0),candidate(2,51,51,2),candidate(3,90,90,3)]
  const a=selectVisiblePhysicalStars(stars,24,4.5)
  assert.deepEqual(a.physicalStars.map(s=>s.hipparcosId),[1,3])
  assert.equal(a.tooClose,1)
  assert.match(physicalToggleError(stars[1],a.physicalStars,24,4.5)??'',/too close/)
  assert.match(physicalToggleError(stars[2],a.physicalStars,2,4.5)??'',/^$/)
  assert.equal(selectVisiblePhysicalStars(stars,24,4.5,
    {mode:'manual',selectedHipIds:[2,3]}).physicalStars.length,2)
  assert.throws(()=>selectVisiblePhysicalStars(stars,129))
})

test('an empty manual set stays empty until the buyer restores automatic selection', () => {
  const input=spaced(12)
  const manual=selectVisiblePhysicalStars(input,24,4.5,{mode:'manual',selectedHipIds:[]})
  assert.equal(manual.physicalStars.length,0)
  const automatic=selectVisiblePhysicalStars(input,24)
  assert.equal(automatic.physicalStars.length,12)
})
