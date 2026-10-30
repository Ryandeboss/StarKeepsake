import test from 'node:test'
import assert from 'node:assert/strict'
import { projectObserverStar, starAppearance, SKY_PATTERNS, suggestedObserverHeading } from '../src/skyImmersiveData.ts'

test('first-person perspective puts the center bearing and altitude at screen center', () => {
  const point = projectObserverStar(180, 30, 180, 30)
  assert.equal(point.inFront, true)
  assert.ok(Math.abs(point.x - 500) < 0.0001)
  assert.ok(Math.abs(point.y - 300) < 0.0001)
})
test('right of observer projects right; a star behind is not rendered', () => {
  const east = projectObserverStar(40, 25, 0, 25)
  const west = projectObserverStar(320, 25, 0, 25)
  assert.ok(east.x > 500)
  assert.ok(west.x < 500)
  assert.equal(projectObserverStar(180, 25, 0, 25).inFront, false)
})
test('angular wrap handles directions crossing the 360 boundary', () => {
  const nearNorth = projectObserverStar(2, 24, 358, 24)
  assert.equal(nearNorth.inFront, true)
  assert.ok(nearNorth.x > 500)
})
test('star color comes only from curated HIP IDs, while size tracks magnitude', () => {
  const red = starAppearance({ hipparcosId: 27989, magnitude: 0.5 })
  const blue = starAppearance({ hipparcosId: 24436, magnitude: 0.2 })
  const blank = starAppearance({ hipparcosId: 999999, magnitude: 2.1 })
  assert.equal(red.category, 'red supergiant')
  assert.equal(blue.category, 'blue-white supergiant')
  assert.equal(blank.named, false)
  assert.equal(blank.category, 'color not catalogued here')
  assert.ok(starAppearance({ hipparcosId: 999999, magnitude: 0 }).radius >
            starAppearance({ hipparcosId: 999999, magnitude: 5 }).radius)
})
test('observer can initially face the brightest curated star', () => {
  const stars = [
    { hipparcosId: 27989, azimuthDeg: 120, magnitude: 0.7 },
    { hipparcosId: 24436, azimuthDeg: 165, magnitude: 0.2 },
  ]
  assert.equal(suggestedObserverHeading(stars), 165)
  assert.equal(suggestedObserverHeading([]), 180)
})
test('curated guide segments connect only known Hipparcos anchor IDs', () => {
  for (const pattern of SKY_PATTERNS) {
    const ids = new Set(pattern.stars.map(star => star.hip))
    for (const [from, to] of pattern.segments) {
      assert.ok(ids.has(from), pattern.id + ' missing from')
      assert.ok(ids.has(to), pattern.id + ' missing to')
    }
  }
  assert.equal(SKY_PATTERNS.find(pattern => pattern.id === 'dipper')?.kind, 'asterism')
  assert.equal(SKY_PATTERNS.find(pattern => pattern.id === 'orion')?.kind, 'constellation')
})
