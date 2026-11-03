import test from 'node:test'
import assert from 'node:assert/strict'
import { projectObserverStar } from '../src/skyImmersiveData.ts'
import { domeWindow } from '../src/skyDomeMath.ts'
import { wrapWorkshopHeading, clampWorkshopPitch } from '../src/skyWorkshopMath.ts'

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
