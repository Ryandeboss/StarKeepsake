import test from 'node:test'
import assert from 'node:assert/strict'
import { PHOTO_FRAME_RATIOS, photoFrameAspect, containPhotoFrame } from '../src/photoSkyPresentation.ts'

test('portrait photos retain natural proportions without cropping in a landscape sky', () => {
  const aspect = photoFrameAspect('original', 1080, 1920)
  const frame = containPhotoFrame(1200, 720, aspect)
  assert.ok(Math.abs(frame.width / frame.height - 1080 / 1920) < 0.000001)
  assert.ok(frame.width <= 1200 * 0.94 && frame.height <= 720 * 0.94)
  assert.ok(frame.width < frame.height, 'portrait remains portrait')
})

test('landscape, square and user-selected common ratios all fit inside the viewport', () => {
  for (const option of PHOTO_FRAME_RATIOS) {
    const aspect = photoFrameAspect(option.id, 1080, 1920)
    const frame = containPhotoFrame(900, 550, aspect)
    assert.ok(Number.isFinite(frame.width) && Number.isFinite(frame.height))
    assert.ok(frame.width > 0 && frame.width <= 900 * .94 + .00001)
    assert.ok(frame.height > 0 && frame.height <= 550 * .94 + .00001)
    assert.ok(Math.abs(frame.width / frame.height - aspect) < .000001)
  }
  assert.equal(photoFrameAspect('4:5',1080,1920), 4/5)
  assert.equal(photoFrameAspect('16:9',1080,1920), 16/9)
  assert.equal(photoFrameAspect('1:1',1080,1920), 1)
})

test('slim/mobile viewports never overflow the photo presentation frame', () => {
  for (const [width,height] of [[320,640],[390,240],[600,260],[900,350]]) {
    for (const ratio of [9/16, 4/5, 1, 4/3, 16/9]) {
      const rect = containPhotoFrame(width,height,ratio)
      assert.ok(rect.width <= width && rect.height <= height)
    }
  }
})

test('invalid viewport dimensions yield no drawable frame', () => {
  assert.deepEqual(containPhotoFrame(0,600,9/16), {width:0,height:0})
  assert.deepEqual(containPhotoFrame(600,0,9/16), {width:0,height:0})
})
