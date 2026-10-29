import test from 'node:test'
import assert from 'node:assert/strict'
import { getFrameLayout } from '../../../contracts/design-spec/design-spec.ts'

test('standard presets report distinct physical dimensions', () => {
 const widths=['8x10','11x14','16x20'].map(id=>getFrameLayout(id).physicalArtwork.widthMm)
 assert.deepEqual(widths,[203.2,279.4,406.4])
})

test('custom frame conforms to image aspect, with no forced crop', () => {
 for(const ratio of [0.4,0.5625,1,1.5,16/9,2.8]) {
  const {physicalArtwork,regions}=getFrameLayout('auto',ratio)
  const photo=regions.engravingPhoto
  assert.ok(Math.abs(photo.widthMm/photo.heightMm-ratio)<0.0001)
  assert.ok(physicalArtwork.heightMm<=508)
  assert.ok(photo.yMm>regions.sky.yMm+regions.sky.heightMm)
  assert.ok(regions.text.yMm>photo.yMm+photo.heightMm)
  assert.ok(regions.text.yMm+regions.text.heightMm<=physicalArtwork.heightMm+.001)
 }
})

test('custom panorama and portrait have visibly different frame ratios',()=>{
 const landscape=getFrameLayout('auto',2.5).physicalArtwork
 const portrait=getFrameLayout('auto',0.45).physicalArtwork
 assert.ok(landscape.widthMm/landscape.heightMm > portrait.widthMm/portrait.heightMm)
})
