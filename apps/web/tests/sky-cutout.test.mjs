import test from 'node:test'
import assert from 'node:assert/strict'
import { hasTransparentSky, maskWhiteSkyPixels } from '../src/skyCutout.ts'

function img(rows) {
  const h=rows.length, w=rows[0].length
  const pixels = new Uint8ClampedArray(w*h*4)
  rows.forEach((row,y)=>row.forEach((rgb,x)=>{
    const i=(y*w+x)*4
    pixels.set([...rgb,255],i)
  }))
  return {pixels,w,h}
}
const W=[255,255,255], B=[17,28,39], L=[250,250,250]
test('flood removes top-connected white sky but leaves dark skyline opaque', () => {
  const {pixels,w,h}=img([
    [W,W,W,W,W],
    [W,W,B,W,W],
    [B,B,B,B,B],
    [B,B,B,B,B],
  ])
  const result=maskWhiteSkyPixels(pixels,w,h)
  assert.equal(result[3],0)
  assert.ok(result[(1*w+2)*4+3] > 150 && result[(1*w+2)*4+3] < 255, 'roof edge softly feathered')
  assert.equal(result[(3*w+2)*4+3],255)
  assert.equal(hasTransparentSky(result),true)
})
test('preserves isolated white window inside buildings', () => {
  const {pixels,w,h}=img([
    [W,W,W,W,W],
    [B,B,B,B,B],
    [B,B,L,B,B],
    [B,B,B,B,B],
  ])
  const result=maskWhiteSkyPixels(pixels,w,h)
  assert.equal(result[(2*w+2)*4+3],255)
  assert.equal(result[3],0)
})
test('smooths bordering bright pixels while keeping darker facade intact', () => {
  const A=[238,239,240]
  const {pixels,w,h}=img([
    [W,W,W],
    [W,A,W],
    [B,B,B],
  ])
  const result=maskWhiteSkyPixels(pixels,w,h)
  const alpha=result[(1*w+1)*4+3]
  assert.ok(alpha>0 && alpha<255)
  assert.equal(result[(2*w+1)*4+3],255)
})
test('rejects mismatched pixel buffer size', () => {
  assert.throws(()=>maskWhiteSkyPixels(new Uint8ClampedArray(3),2,2),/dimensions/)
})

test('removes a white edge halo with soft alpha and decontaminated RGB', () => {
  const {pixels,w,h}=img([
    [W,W,W,W,W],
    [W,[241,242,243],[90,101,112],[241,242,243],W],
    [B,B,B,B,B],
    [B,B,B,B,B],
  ])
  const masked=maskWhiteSkyPixels(pixels,w,h)
  const fringe=(1*w+1)*4
  assert.ok(masked[fringe+3]>0 && masked[fringe+3]<180, 'soft semi-transparent edge')
  assert.ok(masked[fringe] < pixels[fringe], 'red channel decontaminated from white')
  assert.ok(masked[fringe+1] < pixels[fringe+1], 'green channel decontaminated')
  assert.equal(masked[(3*w+2)*4+3], 255, 'interior remains solid')
})
test('contracts the first opaque roof-edge pixel slightly without cutting into windows', () => {
  const {pixels,w,h}=img([
    [W,W,W,W,W],
    [W,B,B,B,W],
    [B,B,L,B,B],
    [B,B,B,B,B],
  ])
  const masked=maskWhiteSkyPixels(pixels,w,h)
  assert.ok(masked[(1*w+2)*4+3]<255)
  assert.equal(masked[(2*w+2)*4+3],255)
})
