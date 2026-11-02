import test from 'node:test'
import assert from 'node:assert/strict'
import { domeWindow, domeAltitudeY, normalizeBearing } from '../src/skyDomeMath.ts'
import { observerHorizonY } from '../src/skyLandscapeData.ts'

test('mini dome heading and FOV occupy correct bearing interval', () => {
  const view = domeWindow(180, 20, 90)
  assert.deepEqual(view.spans, [{startDeg: 135, widthDeg: 90}])
  assert.equal(view.centerBearing, 180)
  assert.ok(view.verticalFov > 55 && view.verticalFov < 70)
})
test('compass footprint wraps across true north without jumping or changing width', () => {
  const a = domeWindow(359, 12, 105)
  const b = domeWindow(1, 12, 105)
  assert.equal(a.spans.length,2)
  assert.equal(b.spans.length,2)
  for (const frame of [a,b]) {
    assert.ok(Math.abs(frame.spans.reduce((total,span)=>total+span.widthDeg,0)-105) < 1e-8)
    assert.ok(frame.spans.every(span=>span.startDeg>=0 && span.startDeg<360))
  }
  assert.equal(normalizeBearing(-1),359)
  assert.equal(normalizeBearing(721),1)
})
test('the golden rectangle moves higher for upward pitch and lower when looking down', () => {
  const low = domeWindow(210,-8,105)
  const mid = domeWindow(210,12,105)
  const high = domeWindow(210,62,105)
  assert.ok(domeAltitudeY(high.centerAltitude) < domeAltitudeY(mid.centerAltitude))
  assert.ok(domeAltitudeY(mid.centerAltitude) < domeAltitudeY(low.centerAltitude))
  assert.ok(domeAltitudeY(high.topAltitude) >= 30)
  assert.ok(domeAltitudeY(low.bottomAltitude) <= 120)
})
test('vertical field of view follows the main 1000x600 perspective camera', () => {
  const fov = 105
  const expected = 2 * Math.atan(Math.tan(fov*Math.PI/360) * .6) * 180 / Math.PI
  assert.ok(Math.abs(domeWindow(0, 20, fov).verticalFov-expected)<1e-10)
})
test('horizon-anchored light follows tilt, not a fixed screen bottom or compass heading', () => {
  const low = observerHorizonY(0, -8,105)
  const level = observerHorizonY(180,0,105)
  const up = observerHorizonY(72,45,105)
  assert.ok(low < level)
  assert.ok(up > level)
  assert.ok(Math.abs(up-observerHorizonY(242,45,105))<.0001)
  assert.ok(up > 600, 'looking upward puts the horizon glow mostly below the frame')
})
