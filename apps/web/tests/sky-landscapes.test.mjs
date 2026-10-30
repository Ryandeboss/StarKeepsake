import test from 'node:test'
import assert from 'node:assert/strict'
import { EXPLORER_LOCATIONS } from '../src/skyExplorerData.ts'
import { OBSERVER_SCENES, getObserverScene, observerHorizonY } from '../src/skyLandscapeData.ts'

test('every selectable city has a distinctive, documented landscape illustration', () => {
  assert.equal(EXPLORER_LOCATIONS.length, 8)
  for (const city of EXPLORER_LOCATIONS) {
    const scene = getObserverScene(city.id)
    assert.ok(scene.title.toLowerCase().includes(city.name.toLowerCase().split(' ')[0].slice(0, 3)) || scene.landmark.length > 4)
    assert.ok(scene.landmark.length >= 5)
    assert.ok(['lake','river','mountains','harbour','coast'].includes(scene.terrain))
  }
  assert.equal(Object.keys(OBSERVER_SCENES).length, EXPLORER_LOCATIONS.length)
  assert.equal(getObserverScene('chicago').landmark, 'Willis Tower')
  assert.equal(getObserverScene('capetown').landmark, 'Table Mountain')
  assert.equal(getObserverScene('sydney').terrain, 'harbour')
})
test('camera altitude moves a level horizon while changing heading does not', () => {
  const level = observerHorizonY(0, 0, 105)
  assert.ok(Math.abs(level - 300) < 0.0001)
  const up = observerHorizonY(25, 22, 105)
  const otherHeading = observerHorizonY(280, 22, 105)
  assert.ok(up > level)
  assert.ok(Math.abs(up - otherHeading) < .0001)
})
test('scene metadata fallback remains safe for unknown locations', () => {
  assert.equal(getObserverScene('not-a-city').title, OBSERVER_SCENES.chicago.title)
})
