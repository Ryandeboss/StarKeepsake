import test from 'node:test'
import assert from 'node:assert/strict'
import { fitAbovePhotoLayout } from '../src/photoSkyLayout.ts'

test('separate sky sits above an uncropped 9:16 portrait inside landscape viewer', () => {
  const frame = fitAbovePhotoLayout(1200, 680, 1080, 1920)
  assert.ok(frame.width > 0 && frame.height > 0)
  assert.ok(frame.height <= 680 * .94 + .0001)
  assert.ok(frame.width <= 1200 * .94 + .0001)
  assert.ok(Math.abs(frame.width / frame.photoHeight - 1080 / 1920) < 0.00001)
  assert.ok(frame.skyHeight > 0 && frame.photoHeight > frame.skyHeight)
  assert.ok(Math.abs(frame.photoHeight + frame.skyHeight - frame.height) < .00001)
})

test('separate sky fits panoramic landscape, square and common portrait ratios without stretching', () => {
  for (const aspect of [9/16,4/5,3/4,1,4/3,16/9,21/9]) {
    const layout=fitAbovePhotoLayout(940,560,1920*aspect,1920)
    assert.ok(layout.width <= 940*.94+.00001)
    assert.ok(layout.height <= 560*.94+.00001)
    assert.ok(Math.abs(layout.width/layout.photoHeight-aspect) < 1e-8)
    assert.ok(Math.abs(layout.skyHeight/layout.photoHeight-.4) < 1e-8)
  }
})

test('mobile view and invalid dimensions remain within bounds',()=>{
  for (const [vw,vh] of [[320,220],[375,660],[600,280]]) {
    const frame=fitAbovePhotoLayout(vw,vh,720,1280)
    assert.ok(frame.width<=vw && frame.height<=vh)
  }
  assert.deepEqual(fitAbovePhotoLayout(0,500,720,1280),{width:0,height:0,skyHeight:0,photoHeight:0})
  assert.deepEqual(fitAbovePhotoLayout(500,500,0,1280),{width:0,height:0,skyHeight:0,photoHeight:0})
})
