import test from 'node:test'
import assert from 'node:assert/strict'
import { NAMED_HIPPARCOS_STARS, starDisplayName, starDescription } from '../src/starDetails.ts'

const sirius = {
  hipparcosId: 32349,
  magnitude: -1.46,
  altitudeDeg: 37.41,
  azimuthDeg: 127.23,
}
const unnamed = {
  hipparcosId: 123456,
  magnitude: 4.32,
  altitudeDeg: 15.2,
  azimuthDeg: 271.9,
}
test('only verified HIP identifiers receive a common name', () => {
  assert.equal(starDisplayName(sirius), 'Sirius')
  assert.equal(starDisplayName(unnamed), 'Hipparcos 123456')
  assert.equal(NAMED_HIPPARCOS_STARS[91262], 'Vega')
  assert.equal(NAMED_HIPPARCOS_STARS[69673], 'Arcturus')
})
test('inspection data uses the calculated star attributes without rounding source coordinates', () => {
  const result = starDescription(sirius)
  assert.match(result, /HIP 32349/)
  assert.match(result, /-1\.46/)
  assert.match(result, /37\.4°/)
  assert.match(result, /127\.2°/)
})
