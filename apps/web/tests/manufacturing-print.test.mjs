import test from 'node:test'
import assert from 'node:assert/strict'
import {printSpecification,embedPngDpi,trimSafeGuideSvg} from '../src/manufacturingPrint.ts'

test('11x14 at 300 DPI has true oversize bleed with centered trim and safe area',()=>{
  const spec=printSpecification(279.4,355.6)
  assert.deepEqual(spec.documentPixels,{width:3375,height:4275})
  assert.deepEqual(spec.trimPixels,{x:37.5,y:37.5,width:3300,height:4200})
  assert.deepEqual(spec.safePixels,{x:112.5,y:112.5,width:3150,height:4050})
  assert.deepEqual(spec.documentSizeIn,{width:11.25,height:14.25})
  assert.equal(spec.bleedIn,.125)
  assert.equal(spec.dpi,300)
  const proof=trimSafeGuideSvg(spec)
  assert.match(proof,/3375 4275/)
  assert.match(proof,/stroke="#e85454"/)
  assert.match(proof,/stroke="#18c2c2"/)
  assert.doesNotMatch(proof,/fill="#ffffff"/)
})
test('print lab settings can be adjusted; invalid geometry held',()=>{
  const s=printSpecification(279.4,355.6,{bleedIn:.25,safeIn:.375,dpi:300})
  assert.equal(s.documentPixels.width,3450)
  assert.equal(s.documentPixels.height,4350)
  assert.throws(()=>printSpecification(279.4,355.6,{bleedIn:-1,safeIn:.25,dpi:300}))
  assert.throws(()=>printSpecification(279.4,355.6,{bleedIn:.125,safeIn:.25,dpi:96}))
})
test('PNG physical DPI metadata is set to 300 not browser default 96',()=>{
  // Correct minimal 1x1 PNG encoded once; encoder must not touch IDAT bytes.
  const png=Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGXcAAAAASUVORK5CYII=', 'base64'))
  const updated=embedPngDpi(png,300)
  assert.deepEqual([...updated.slice(0,8)],[137,80,78,71,13,10,26,10])
  assert.equal(new DataView(updated.buffer).getUint32(41,false),Math.round(300/.0254))
  assert.equal(updated.length,png.length+21)
  assert.throws(()=>embedPngDpi(new Uint8Array([1,2]),300))
})
