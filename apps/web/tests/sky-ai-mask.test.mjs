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
