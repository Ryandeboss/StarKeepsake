import test from 'node:test'
import assert from 'node:assert/strict'
import { projectObserverStar } from '../src/skyImmersiveData.ts'
import { domeWindow } from '../src/skyDomeMath.ts'
import { wrapWorkshopHeading, clampWorkshopPitch } from '../src/skyWorkshopMath.ts'
import { skyAboveArtworkAspect,skyAbovePhotoStyle } from '../src/frameSkyBalance.ts'

test('workshop orientation changes the actual star projection',()=>{
  const star={azimuthDeg:90,altitudeDeg:35}
  const east=projectObserverStar(star.azimuthDeg,star.altitudeDeg,90,15,95)
  const north=projectObserverStar(star.azimuthDeg,star.altitudeDeg,0,15,95)
  assert.equal(east.inFront,true)
  assert.notEqual(east.x,north.x)
  assert.ok(Math.abs(east.x-500)<15)
})
test('NESW mini dome tracks heading and vertical field of view',()=>{
  const a=domeWindow(wrapWorkshopHeading(359),clampWorkshopPitch(18),105)
  const b=domeWindow(90,65,85)
  assert.equal(a.spans.length,2,'north wrap is drawn in two pieces')
  assert.equal(b.centerBearing,90)
  assert.ok(b.bottomAltitude>a.bottomAltitude)
  assert.ok(b.topAltitude<=90)
})

import { observerPointInPanel } from '../src/skyWorkshopMath.ts'
test('photographic stars stay round while viewport crop tracks portrait frames',()=>{
  const center=observerPointInPanel(500,300,.75)
  assert.ok(center.inside)
  assert.equal(center.x,.5)
  assert.equal(center.y,.5)
  assert.equal(observerPointInPanel(10,300,.75).inside,false)
  assert.equal(observerPointInPanel(500,10,3).inside,false)
  assert.equal(observerPointInPanel(500,300,3).inside,true)
})

test('sky above and whole original photo always share identical left and right edges',()=>{
  for(const imageAspect of [0.45,0.67,1,1.5,1.78,2.7]){
    for(const skyPercent of [20,38,50,70]){
      const composite=skyAboveArtworkAspect(imageAspect,skyPercent)
      const lowerFraction=1-skyPercent/100
      const lowerAspect=composite/lowerFraction
      assert.ok(Math.abs(lowerAspect-imageAspect)<1e-11,
        `Photo ${imageAspect}, sky ${skyPercent}% must fill entire width`)
    }
  }
  assert.throws(()=>skyAboveArtworkAspect(0,38),/aspect/)
  assert.throws(()=>skyAboveArtworkAspect(1.5,100),/percentage/)
})

test('whole-photo style reaches both sides of its photo panel in above mode',()=>{
  assert.equal(skyAbovePhotoStyle('fit').objectFit,'cover')
  assert.equal(skyAbovePhotoStyle('top-crop').objectFit,'cover')
  assert.equal(skyAbovePhotoStyle('bottom-crop').objectFit,'cover')
  // Exact lower-panel aspect: no missing horizontal pixels from contain bars.
  for(const photoAspect of [.38,.67,1,1.5,2.8]){
    for(const split of [20,38,50,70]){
      const composite=skyAboveArtworkAspect(photoAspect,split)
      const photoPanelAspect=composite/(1-split/100)
      assert.ok(Math.abs(photoPanelAspect-photoAspect)<1e-11)
    }
  }
})
