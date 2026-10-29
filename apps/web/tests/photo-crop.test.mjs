import test from 'node:test'
import assert from 'node:assert/strict'
import { FULL_PHOTO_CROP, getCoverCrop, clampCrop, croppedImageStyle } from '../src/photoCrop.ts'

test('contain fit always uses the full original image', () => {
  assert.deepEqual(FULL_PHOTO_CROP, { x: 0, y: 0, width: 1, height: 1 })
})

test('cover uses the physical photo panel ratio for portrait and landscape originals', () => {
  const photoPanelRatio = 267.4 / 142.24
  for (const [width, height] of [[1200, 1600], [2400, 1350], [1280, 720], [800, 800]]) {
    const crop = getCoverCrop(width, height, photoPanelRatio)
    assert.ok(crop.x >= 0 && crop.y >= 0)
    assert.ok(crop.x + crop.width <= 1)
    assert.ok(crop.y + crop.height <= 1)
    const actualRatio = width * crop.width / (height * crop.height)
    assert.ok(Math.abs(actualRatio - photoPanelRatio) < 1e-10)
  }
})

test('panning stays inside the source and keeps the zoom rectangle dimensions', () => {
  const original = getCoverCrop(1200, 1800, 1.85)
  const crop = clampCrop({ ...original, x: 100, y: -100 })
  assert.equal(crop.x, 0)
  assert.ok(crop.y + crop.height <= 1)
  assert.equal(crop.width, original.width)
  assert.equal(crop.height, original.height)
})

test('cropped preview CSS is derived exactly from the normalized crop', () => {
  const crop = { x: 0.125, y: 0.25, width: 0.5, height: 0.5 }
  const style = croppedImageStyle(crop)
  assert.equal(style.left, '-25%')
  assert.equal(style.top, '-50%')
  assert.equal(style.width, '200%')
  assert.equal(style.height, '200%')
  assert.equal(style.objectFit, 'fill')
})
