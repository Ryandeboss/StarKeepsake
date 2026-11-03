import test from 'node:test'
import assert from 'node:assert/strict'
import {
  colorRegion, changeRegionAlpha, paintAlphaLine,
  fillMaskPolygon, getAlpha, composeSkyCutout, maskWorkingDimensions,
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
const WINDOW = [248,247,246]

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
  assert.equal(alpha[3*w+0],0)
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

test('manual sky-mask editor preserves portrait and panorama aspect ratios', () => {
  assert.deepEqual(maskWorkingDimensions(1200, 1800), { width:1200,height:1800 })
  assert.deepEqual(maskWorkingDimensions(4000, 6000), { width:1733,height:2600 })
  assert.deepEqual(maskWorkingDimensions(6000, 3000), { width:2600,height:1300 })
  assert.throws(() => maskWorkingDimensions(9000, 8000), /50 megapixels/)
  assert.throws(() => maskWorkingDimensions(0, 500), /valid photo/)
})

import { resampleSkyAlpha, wrapWorkshopHeading, clampWorkshopPitch, containWorkshopPhoto } from '../src/skyWorkshopMath.ts'

test('AI horizon mask rescales without reversing foreground and sky', () => {
  const mask={width:2,height:2,alpha:new Uint8ClampedArray([0,255,0,255])}
  const enlarged=resampleSkyAlpha(mask,4,4)
  assert.deepEqual([...enlarged.slice(0,4)],[0,0,255,255])
  assert.deepEqual([...enlarged.slice(12,16)],[0,0,255,255])
  assert.throws(()=>resampleSkyAlpha({...mask,width:3},4,4),/dimensions/)
})
test('orientation normalization and contain geometry keep stars in photo bounds', () => {
  assert.equal(wrapWorkshopHeading(-45),315)
  assert.equal(wrapWorkshopHeading(450),90)
  assert.equal(clampWorkshopPitch(100),88)
  assert.equal(clampWorkshopPitch(-30),-8)
  assert.deepEqual(containWorkshopPhoto(600,300,1),{
    left:150, top:0, width:300, height:300
  })
  assert.deepEqual(containWorkshopPhoto(300,600,2),{
    left:0, top:225, width:300, height:150
  })
})

import { conservativeSkyMask,smartRectangleCleanup } from '../src/skyWorkshopMask.ts'

test('conservative AI horizon removes only the upper-connected inner sky',()=>{
  const w=9,h=7,raw=new Uint8Array(w*h)
  for(let y=0;y<4;y++)for(let x=0;x<w;x++)raw[y*w+x]=1
  raw[6*w+4]=1 // isolated false positive: a light facade/window
  const safe=conservativeSkyMask(raw,w,h,1)
  assert.equal(safe[6*w+4],0)
  assert.equal(safe[1*w+4],1)
  assert.equal(safe[3*w+4],0,'safety margin above foreground')
  assert.equal(safe[0],1,'keep upper image edge open')
})
test('smart rectangle cleans bright sky pockets, not dark tree branches',()=>{
  const w=4,h=3,original=new Uint8ClampedArray(w*h*4)
  for(let i=0;i<w*h;i++)original.set([244,244,242,255],i*4)
  original.set([35,43,50,255],(1*w+1)*4)
  const mask=new Uint8ClampedArray(w*h).fill(255)
  const edited=smartRectangleCleanup(original,mask,w,h,{x0:0,y0:0,x1:4,y1:3},false)
  assert.equal(edited,w*h-1)
  assert.equal(mask[1*w+1],255)
  assert.equal(mask[0],0)
  const restored=smartRectangleCleanup(original,mask,w,h,{x0:0,y0:0,x1:2,y1:2},true)
  assert.equal(restored,3)
  assert.equal(mask[0],255)
  assert.equal(mask[1*w+1],255)
})
