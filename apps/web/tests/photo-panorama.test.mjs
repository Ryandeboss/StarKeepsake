import test from 'node:test'
import assert from 'node:assert/strict'
import { panoramaUvForDirection, observerDirectionAtPixel } from '../src/panoramaProjection.ts'
import { projectObserverStar } from '../src/skyImmersiveData.ts'

test('panorama center bearing always maps to the image center', () => {
  assert.ok(Math.abs(panoramaUvForDirection(148, 0, 148, .1).u - .5) < 1e-9)
  assert.equal(panoramaUvForDirection(148, 0, 148, .1).v, .6)
})
test('panoramic texture wraps across north without speed or seam changes', () => {
  const a = panoramaUvForDirection(1, 0, 180)
  const b = panoramaUvForDirection(361, 0, 180)
  assert.ok(Math.abs(a.u - b.u) < 1e-9)
})
test('photo sampling ray and calculated star projection agree in one perspective camera', () => {
  const combos = [
    [180, 12, 105, 400, 220],
    [45, 28, 90, 790, 380],
    [350, 3, 115, 250, 290],
    [70, 15, 70, 550, 350],
  ]
  for (const [heading, pitch, fov, x, y] of combos) {
    const ray = observerDirectionAtPixel(x, y, heading, pitch, fov)
    const p = projectObserverStar(ray.azimuthDeg, ray.altitudeDeg, heading, pitch, fov)
    assert.ok(Math.abs(p.x - x) < 0.001, 'horizontal mismatch')
    assert.ok(Math.abs(p.y - y) < 0.001, 'vertical mismatch')
  }
})
test('level horizon maps to the same row independently of compass bearing', () => {
  assert.equal(panoramaUvForDirection(10, 0, 160, .1).v, panoramaUvForDirection(330, 0, 160, .1).v)
})
