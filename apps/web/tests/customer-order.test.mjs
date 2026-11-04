import test from 'node:test'
import assert from 'node:assert/strict'
import {orderReference,makeOrderManifest,orderPersonalization,zipFiles}
  from '../src/orderManifest.ts'
// Fixture avoids runtime dependencies on the React/Vite-only designSpec module.
const INITIAL_DESIGN_SPEC={
  schemaVersion:'1.5',designId:'test',photoAspectRatio:1,
  physicalArtwork:{widthMm:279.4,heightMm:355.6,units:'mm',origin:'top-left'},
  moment:{date:'2024-07-04',time:'21:00',location:{displayName:'Chicago'}},
  customText:{value:'',align:'center'},
  stars:[{hipparcosId:1,altitudeDeg:30,azimuthDeg:95,magnitude:1}],
}
const prefs={layout:'above',heading:180,pitch:18,fov:105,skyHeight:38,
  photoFit:'fit',tone:'natural',glow:true,inscription:'Our first night'}
test('reference identifies exact design and photo bytes, deterministically',async()=>{
  const a=await orderReference(INITIAL_DESIGN_SPEC,prefs,new Uint8Array([3,1]))
  const b=await orderReference(INITIAL_DESIGN_SPEC,prefs,new Uint8Array([3,1]))
  const c=await orderReference(INITIAL_DESIGN_SPEC,prefs,new Uint8Array([3,2]))
  assert.match(a,/^SK-[A-F0-9]{12}$/);assert.equal(a,b);assert.notEqual(a,c)
})
test('order manifest is unpaid, with source and canonical mm geometry',()=>{
  const m=makeOrderManifest('SK-1234567890AB',INITIAL_DESIGN_SPEC,prefs,
    {name:'photo.jpg',bytes:4,mime:'image/jpeg'},'2026-11-04T16:00:00Z')
  assert.equal(m.status,'UNPAID_PREVIEW')
  assert.equal(m.design.physicalArtwork.units,'mm')
  assert.equal(m.design.customText.value,'Our first night')
  assert.equal(m.expectedFiles[0],'order-sheet.png')
  assert.ok(orderPersonalization(m).includes('SK-1234567890AB'))
})
test('ZIP includes local and central headers, files and rejects path traversal',()=>{
  const bytes=zipFiles([{name:'order.json',data:new TextEncoder().encode('{}')},
    {name:'photo.jpg',data:new Uint8Array([1,2,3])}])
  const dv=new DataView(bytes.buffer)
  assert.equal(dv.getUint32(0,true),0x04034b50)
  assert.equal(dv.getUint32(bytes.length-22,true),0x06054b50)
  assert.equal(dv.getUint16(bytes.length-12,true),2)
  assert.ok(new TextDecoder().decode(bytes).includes('photo.jpg'))
  assert.throws(()=>zipFiles([{name:'../path',data:new Uint8Array()}]),/filename/)
})
