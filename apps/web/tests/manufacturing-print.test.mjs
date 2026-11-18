import test from 'node:test'
import assert from 'node:assert/strict'
import {printSpecification,embedPngDpi,trimSafeGuideSvg,PRINT_VARIANTS} from '../src/manufacturingPrint.ts'

test('11x14 at 300 DPI has true oversize bleed with centered trim and safe area',()=>{
  const spec=printSpecification(279.4,355.6)
  assert.deepEqual(spec.documentPixels,{width:3450,height:4350})
  assert.deepEqual(spec.trimPixels,{x:75,y:75,width:3300,height:4200})
  assert.deepEqual(spec.safePixels,{x:150,y:150,width:3150,height:4050})
  assert.deepEqual(spec.documentSizeIn,{width:11.5,height:14.5})
  assert.equal(spec.bleedIn,.25)
  assert.match(spec.labInstructions,/bleed is 0.25 in per edge/)
  assert.match(spec.labInstructions,/does not auto-fit or crop/)
  assert.equal(spec.dpi,300)
  const proof=trimSafeGuideSvg(spec)
  assert.match(proof,/3450 4350/)
  assert.match(proof,/stroke="#e85454"/)
  assert.match(proof,/stroke="#18c2c2"/)
  assert.doesNotMatch(proof,/fill="#ffffff"/)
})
test('print lab settings can be adjusted; invalid geometry held',()=>{
  const s=printSpecification(279.4,355.6,{bleedIn:.125,safeIn:.375,dpi:300})
  assert.deepEqual(s.documentPixels,{width:3375,height:4275})
  assert.deepEqual(s.trimPixels,{x:37.5,y:37.5,width:3300,height:4200})
  assert.equal(s.bleedIn,.125)
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

test('exact, 1/8 and 1/4-inch variants share 11x14 trim at 300 DPI',()=>{
  const a=PRINT_VARIANTS.map(v=>printSpecification(279.4,355.6,
    {bleedIn:v.bleedIn,safeIn:.25,dpi:300}))
  assert.deepEqual(a.map(x=>x.documentPixels),[
    {width:3300,height:4200},{width:3375,height:4275},{width:3450,height:4350}
  ])
  assert.deepEqual(a.map(x=>x.documentSizeIn),[
    {width:11,height:14},{width:11.25,height:14.25},{width:11.5,height:14.5}
  ])
  assert.ok(a.every(x=>x.trimPixels.width===3300&&x.trimPixels.height===4200))
  assert.ok(a.every(x=>x.reviewStatus==='PROOF_REQUIRED'&&x.dpi===300))
  assert.equal(new Set(PRINT_VARIANTS.map(v=>v.artwork)).size,3)
})
