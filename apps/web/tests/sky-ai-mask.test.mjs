import test from 'node:test'
import assert from 'node:assert/strict'
import { applySkyAlpha, maskLooksUsable } from '../src/skyAiMask.ts'

test('sky-only matte removes white sky while leaving buildings and branches at original RGB', () => {
  const original = new Uint8ClampedArray([
    255,255,255,255,   // bright sky
    12,25,37,255,      // dark branch
    230,210,166,255,  // lit building window
    10,24,37,255,     // lake water
  ])
  const mask = new Uint8ClampedArray([
    255,255,255,255,
    0,0,0,255,
    0,0,0,255,
    0,0,0,255,
  ])
  const result=applySkyAlpha(original,mask)
  assert.deepEqual([...result],[
    255,255,255,0,
    12,25,37,255,
    230,210,166,255,
    10,24,37,255,
  ])
  assert.deepEqual([...original.slice(0,4)],[255,255,255,255], 'input stays untouched')
})
test('gray edge mask creates a feathered transparency boundary',()=>{
  const original=new Uint8ClampedArray([20,40,60,255])
  const mask=new Uint8ClampedArray([128,128,128,255])
  const result=applySkyAlpha(original,mask)
  assert.ok(result[3]>=126 && result[3]<=128)
  assert.deepEqual([...result.slice(0,3)],[20,40,60])
})
test('invert AI mask restores reverse orientation without regenerating pixels',()=>{
  const original=new Uint8ClampedArray([30,40,50,255,80,90,100,180])
  const mask=new Uint8ClampedArray([255,255,255,255,0,0,0,255])
  const flipped=applySkyAlpha(original,mask,true)
  assert.equal(flipped[3],255)
  assert.equal(flipped[7],0)
  assert.deepEqual([...flipped.slice(0,3)],[30,40,50])
})
test('reject empty, all-white, and incorrectly sized masks',()=>{
  assert.equal(maskLooksUsable(new Uint8ClampedArray(16)),false)
  assert.equal(maskLooksUsable(new Uint8ClampedArray(16).fill(255)),false)
  const mixed=new Uint8ClampedArray(16)
  mixed.fill(255,0,4)
  assert.equal(maskLooksUsable(mixed),true)
  assert.throws(()=>applySkyAlpha(new Uint8ClampedArray(8),new Uint8ClampedArray(4)),/dimensions/)
})

function grid(width, height, color, maskSky = 255) {
  const original = new Uint8ClampedArray(width * height * 4)
  const mask = new Uint8ClampedArray(width * height * 4)
  for (let p = 0; p < width * height; p++) {
    original.set([...color, 255], p * 4)
    mask.set([maskSky, maskSky, maskSky, 255], p * 4)
  }
  function pixel(x,y,rgb,sky) {
    const index = (y * width + x) * 4
    original.set([...rgb,255], index)
    mask.set([sky,sky,sky,255], index)
  }
  return { original, mask, pixel, getAlpha: (arr,x,y) => arr[(y*width+x)*4+3] }
}

test('expands sky into its bright halo while preserving single-pixel dark branches', () => {
  const { original, mask, pixel, getAlpha } = grid(9, 7, [246, 247, 250])
  for (let y=0; y<7; y++) {
    pixel(4,y,[239,240,242],0) // pale sky residue, AI called it foreground
    pixel(5,y,[28,33,38],0)   // building should remain
    pixel(6,y,[28,33,38],0)
    pixel(7,y,[28,33,38],0)
    pixel(8,y,[28,33,38],0)
  }
  pixel(2,1,[16,22,28],0) // thin twig surrounded by sky, must survive
  const inputCopy = new Uint8ClampedArray(original)
  const out = applySkyAlpha(original,mask,false,{
    width:9,height:7,cleanupPx:2,decontaminate:false,
  })
  assert.ok(getAlpha(out,4,3) < 20, 'bright sky fringe is removed')
  assert.equal(getAlpha(out,5,3),255,'building edge stays opaque')
  assert.equal(getAlpha(out,2,1),255,'dark branch stays opaque')
  assert.deepEqual(original,inputCopy,'original RGB and alpha stay untouched')
})

test('clean-up slider 0 exactly preserves the original AI alpha values', () => {
  const {original,mask,pixel,getAlpha}=grid(5,3,[245,246,247])
  pixel(2,1,[242,243,245],0)
  const out=applySkyAlpha(original,mask,false,{width:5,height:3,cleanupPx:0,decontaminate:false})
  assert.equal(getAlpha(out,2,1),255)
})

test('edge-only halo decontamination keeps solid building and interior RGB unchanged', () => {
  const { original, mask, pixel }=grid(5,3,[250,250,255])
  pixel(2,1,[173,175,179],100)
  pixel(3,1,[20,28,36],0)
  pixel(4,1,[20,28,36],0)
  const before=new Uint8ClampedArray(original)
  const out=applySkyAlpha(original,mask,false,{width:5,height:3,cleanupPx:1,decontaminate:true})
  const edge=(1*5+2)*4
  assert.ok(out[edge] <= before[edge],'sky contamination is not retained on the edge')
  const solid=(1*5+3)*4
  assert.deepEqual([...out.slice(solid,solid+4)],[...before.slice(solid,solid+4)])
})

test('cleanup rejects inconsistent output dimensions and clamps oversized radii', () => {
  const {original,mask}=grid(3,3,[255,255,255])
  assert.throws(()=>applySkyAlpha(original,mask,false,{
    width:4,height:3,cleanupPx:3,decontaminate:true,
  }), /dimensions/)
  assert.doesNotThrow(()=>applySkyAlpha(original,mask,false,{
    width:3,height:3,cleanupPx:100,decontaminate:true,
  }))
})
