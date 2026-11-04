import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SKY_PERCENT, fitAbovePhotoLayout } from '../src/photoSkyLayout.ts'

test('portrait image fits in a stable outer frame at the default split', () => {
  const f=fitAbovePhotoLayout(1200,680,1080,1920)
  assert.ok(f.width > 0 && f.height > 0)
  assert.ok(f.width <= 1200*.94+.001)
  assert.ok(f.height <= 680*.94+.001)
  assert.equal(DEFAULT_SKY_PERCENT,38)
  assert.ok(Math.abs(f.skyHeight/f.height-.38) < 1e-9)
  assert.ok(Math.abs(f.width/f.photoHeight-1080/1920) < 1e-9)
})

test('moving the sky slider reallocates sections without changing outer frame',()=>{
  const inputs=[20,38,55,70].map(s=>fitAbovePhotoLayout(960,640,1200,1600,s))
  for(let i=0;i<inputs.length;i++){
    const f=inputs[i]
    assert.equal(f.width,inputs[0].width)
    assert.equal(f.height,inputs[0].height)
    assert.ok(Math.abs(f.skyHeight/f.height-[.2,.38,.55,.7][i])<1e-9)
    assert.ok(Math.abs(f.skyHeight+f.photoHeight-f.height)<1e-9)
  }
  assert.ok(inputs[0].photoHeight>inputs[3].photoHeight)
})

test('wide, square, and portrait uploads fit mobile and desktop viewports',()=>{
  for(const [pw,ph] of [[1080,1920],[1200,1200],[1920,1080],[2520,1080]]){
    for(const [vw,vh] of [[340,280],[375,640],[1100,640]]){
      const f=fitAbovePhotoLayout(vw,vh,pw,ph,50)
      assert.ok(f.width<=vw*.94+.001 && f.height<=vh*.94+.001)
      assert.ok(f.width>0 && f.height>0)
    }
  }
})

test('extreme and invalid percentages are clamped, invalid size has empty layout',()=>{
  const lo=fitAbovePhotoLayout(800,600,1080,1920,-5)
  const hi=fitAbovePhotoLayout(800,600,1080,1920,98)
  assert.ok(Math.abs(lo.skyHeight/lo.height-.2)<1e-9)
  assert.ok(Math.abs(hi.skyHeight/hi.height-.7)<1e-9)
  assert.deepEqual(fitAbovePhotoLayout(0,600,1080,1920),{width:0,height:0,skyHeight:0,photoHeight:0})
  assert.deepEqual(fitAbovePhotoLayout(800,600,0,1920),{width:0,height:0,skyHeight:0,photoHeight:0})
})
