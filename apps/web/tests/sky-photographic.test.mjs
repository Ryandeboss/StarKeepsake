import test from 'node:test'
import assert from 'node:assert/strict'
import { altitudeForCameraPixel, skyRgb, starOptics } from '../src/skyPhotographicMath.ts'
import { projectObserverStar } from '../src/skyImmersiveData.ts'

test('sky pixel perspective matches the known altitude at screen center', () => {
  for (const pitch of [0,15,35,70]) {
    assert.ok(Math.abs(altitudeForCameraPixel(500,300,pitch,105)-pitch)<1e-9)
  }
  const projected = projectObserverStar(180,5,180,25,105)
  assert.ok(Math.abs(altitudeForCameraPixel(projected.x, projected.y,25,105)-5)<1e-8)
})
test('sky is near-black away from horizon and not a solid saturated-blue rectangle', () => {
  const zenith = skyRgb(500,300,75,105,true)
  const horizon = skyRgb(500,300,2,105,true)
  assert.ok(zenith[0]<18 && zenith[1]<28 && zenith[2]<42)
  assert.ok(horizon[0] > zenith[0])
  assert.ok(horizon[1] > zenith[1])
  assert.notDeepEqual(zenith,horizon)
})
test('city glow follows altitude instead of staying at the bottom when camera tilts up', () => {
  const low = skyRgb(500,300,0,105,true)
  const high = skyRgb(500,300,80,105,true)
  assert.ok(low[0] >= high[0] + 15)
  assert.ok(low[1] >= high[1] + 10)
  assert.ok(low.every(v=>v>=0 && v<=255))
})
test('enhanced mode increases warm horizon light without inventing catalog stars', () => {
  const enhanced = skyRgb(500,300,1,105,true)
  const natural = skyRgb(500,300,1,105,false)
  assert.ok(enhanced[0]>natural[0])
  assert.ok(enhanced[1]>natural[1])
})
test('brighter catalog stars have wider point-spread halos and low-altitude extinction', () => {
  const bright = starOptics(-1,65,true,true)
  const dim = starOptics(5,65,false,true)
  const low = starOptics(-1,3,true,true)
  assert.ok(bright.coreRadius>dim.coreRadius)
  assert.ok(bright.haloRadius>dim.haloRadius)
  assert.ok(low.coreOpacity < bright.coreOpacity)
  assert.ok(low.haloOpacity < bright.haloOpacity)
  assert.ok(!starOptics(5,65,false,true).spikes)
  assert.ok(!starOptics(-1,65,true,false).spikes)
})

test('horizon glow toggle genuinely turns off warm haze, not just dims it',()=>{
  const on=skyRgb(500,300,2,105,true,true)
  const off=skyRgb(500,300,2,105,true,false)
  assert.ok(on[0] >= off[0]+15,'warm light must disappear entirely')
  assert.ok(on[1] >= off[1]+8)
  const highOn=skyRgb(500,300,75,105,true,true)
  const highOff=skyRgb(500,300,75,105,true,false)
  assert.ok(Math.abs(highOn[0]-highOff[0])<3,'high sky stays dark with either setting')
})
test('horizon glow moves downward in the camera when looking upward',()=>{
  const middle=skyRgb(500,300,44,105,true,true)
  const bottom=skyRgb(500,575,44,105,true,true)
  assert.ok(bottom[0]>middle[0]+7,'horizon now lies near lower edge')
  const offBottom=skyRgb(500,575,44,105,true,false)
  assert.ok(bottom[0]>offBottom[0]+12,'optional glow follows the projected horizon')
})
