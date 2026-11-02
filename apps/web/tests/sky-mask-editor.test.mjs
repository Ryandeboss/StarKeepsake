import test from 'node:test'
import assert from 'node:assert/strict'
import {
  colorRegion, changeRegionAlpha, paintAlphaLine,
  fillMaskPolygon, getAlpha, composeSkyCutout,
} from '../src/skyMaskMath.ts'
import { maskWhiteSkyPixels } from '../src/skyCutout.ts'

function image(rows) {
  const h = rows.length, w = rows[0].length
  const pixels = new Uint8ClampedArray(w*h*4)
  rows.forEach((row,y) => row.forEach((rgb,x) => {
    pixels.set([...rgb,255],(y*w+x)*4)
  }))
  return {pixels,w,h}
}
const WHITE = [255,255,255]
const DARK = [20,31,42]
const WINDOW = [248,247,242]

test('wand removes a disconnected white hole between branches without touching a lit window', () => {
  const {pixels,w,h}=image([
    [WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE],
    [DARK,DARK,DARK,DARK,DARK,DARK,DARK],
    [DARK,WHITE,WHITE,DARK,WINDOW,DARK,DARK],
    [DARK,WHITE,WHITE,DARK,DARK,DARK,DARK],
    [DARK,DARK,DARK,DARK,DARK,DARK,DARK],
  ])
  const auto=maskWhiteSkyPixels(pixels,w,h)
  const alpha=getAlpha(auto)
  assert.equal(alpha[2*w+1],255,'existing top-connected auto mask leaves enclosed sky')
  const region=colorRegion(pixels,w,h,1,2,15,true)
  const changed=changeRegionAlpha(alpha,region,pixels,false)
  assert.equal(changed,4)
  assert.equal(alpha[2*w+1],0)
  assert.equal(alpha[2*w+4],255,'isolated similarly pale window protected by connectivity')
  assert.equal(alpha[4*w+0],255)
})
test('global wand can intentionally select disconnected same-color islands', () => {
  const {pixels,w,h}=image([[WHITE,DARK,WHITE],[DARK,DARK,DARK]])
  const region=colorRegion(pixels,w,h,0,0,2,false)
  assert.equal(region[0],1)
  assert.equal(region[2],1)
  assert.equal(region[1],0)
})
test('wand tolerance handles near-white JPEG noise and ignores dark branches', () => {
  const {pixels,w,h}=image([[[255,255,255],[244,249,250],DARK]])
  assert.deepEqual([...colorRegion(pixels,w,h,0,0,12,true)],[1,1,0])
  assert.deepEqual([...colorRegion(pixels,w,h,0,0,5,true)],[1,0,0])
  assert.deepEqual([...colorRegion(pixels,w,h,10,10,20,true)],[0,0,0])
})
test('remove and restore brush strokes preserve original RGB and alpha', () => {
  const {pixels,w,h}=image(Array.from({length:7},()=>Array.from({length:7},()=>DARK)))
  const alpha=getAlpha(pixels)
  paintAlphaLine(alpha,pixels,w,h,1,3,5,3,1,false)
  assert.equal(alpha[3*w+3],0)
  assert.equal(alpha[0],255)
  paintAlphaLine(alpha,pixels,w,h,2,3,4,3,1,true)
  assert.equal(alpha[3*w+3],255)
  assert.equal(alpha[3*w+1],0)
})
test('traced polygon cuts an enclosed patch without clearing its surroundings', () => {
  const {pixels,w,h}=image(Array.from({length:8},()=>Array.from({length:8},()=>DARK)))
  const alpha=getAlpha(pixels)
  const count=fillMaskPolygon(alpha,pixels,w,h,[{x:2,y:2},{x:6,y:2},{x:6,y:6},{x:2,y:6}],false)
  assert.ok(count>0)
  assert.equal(alpha[4*w+4],0)
  assert.equal(alpha[1*w+1],255)
  fillMaskPolygon(alpha,pixels,w,h,[{x:2,y:2},{x:6,y:2},{x:6,y:6},{x:2,y:6}],true)
  assert.equal(alpha[4*w+4],255)
})
test('export keeps the old auto-edge RGB cleanup and restores original photo when requested', () => {
  const {pixels,w,h}=image([
    [WHITE,WHITE,WHITE,WHITE,WHITE],
    [WHITE,[241,242,243],DARK,[241,242,243],WHITE],
    [DARK,DARK,DARK,DARK,DARK],
  ])
  const auto=maskWhiteSkyPixels(pixels,w,h)
  const alpha=getAlpha(auto)
  const first=composeSkyCutout(pixels,auto,alpha)
  const index=(1*w+1)*4
  assert.ok(first[index]<pixels[index],'remove white matte before saving')
  const region=colorRegion(pixels,w,h,0,0,0,true)
  changeRegionAlpha(alpha,region,pixels,true)
  const restored=composeSkyCutout(pixels,auto,alpha)
  assert.equal(restored[3],255)
  assert.equal(restored[0],255,'restore uses original RGB')
  assert.throws(()=>composeSkyCutout(pixels,auto,new Uint8ClampedArray(1)),/dimensions/)
})
