import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendedSkyPlacement } from '../src/skyPlacement.ts'

test('Detected sky defaults to woven into the photograph', () => {
  assert.equal(recommendedSkyPlacement(23), 'within')
  assert.equal(recommendedSkyPlacement(3), 'within')
})
test('Missing, uncertain or failed detection defaults to sky above', () => {
  assert.equal(recommendedSkyPlacement(0), 'above')
  assert.equal(recommendedSkyPlacement(2.9), 'above')
  assert.equal(recommendedSkyPlacement(NaN), 'above')
  assert.equal(recommendedSkyPlacement(Infinity), 'above')
})
