import test from 'node:test'
import assert from 'node:assert/strict'
import { recoverMissedSkyMask } from '../src/skyMissedSkyRecovery.ts'
import { applySkyAlpha } from '../src/skyAiMask.ts'

function fixture(width, height, rgb=[245,245,245], aiSky=255) {
  const original = new Uint8ClampedArray(width*height*4)
  const mask = new Uint8ClampedArray(width*height*4)
  const pixel=(x,y,color=rgb,sky=aiSky) => {
    const i=(y*width+x)*4
    original.set([...color,255],i)
    mask.set([sky,sky,sky,255],i)
  }
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) pixel(x,y)
  const get=(arr,x,y)=>arr[(y*width+x)*4]
  return { original,mask,pixel,get }
}

test('recovers left-connected bright tree canopy sky but keeps dark one-pixel branches',()=>{
  const f=fixture(16,12)
  // AI missed this substantial patch: simulate the Chicago white canopy.
  for(let y=1;y<7;y++) for(let x=0;x<8;x++) f.pixel(x,y,[245,245,245],0)
  for(let y=1;y<7;y++) f.pixel(3,y,[35,42,49],0)
  // Gaps to the right of a branch still reach the AI sky region at x=8.
  const result=recoverMissedSkyMask(f.original,f.mask,false,{width:16,height:12,strength:2})
  assert.equal(f.get(result,1,3),255,'top/left connected sky removed')
  assert.equal(f.get(result,6,3),255,'sky between dark branches removed')
  assert.equal(f.get(result,3,3),0,'thin branch survives')
  assert.equal(f.get(f.mask,1,3),0,'provider mask was not mutated')
  const alpha=applySkyAlpha(f.original,result,false,{width:16,height:12,cleanupPx:0,decontaminate:false})
  assert.equal(alpha[(3*16+1)*4+3],0)
  assert.equal(alpha[(3*16+3)*4+3],255)
})

test('protects dark building geometry and opaque original RGB',()=>{
  const f=fixture(14,12)
  for(let y=2;y<12;y++) for(let x=8;x<14;x++) f.pixel(x,y,[24,32,44],0)
  for(let y=2;y<7;y++) for(let x=1;x<8;x++) f.pixel(x,y,[244,245,246],0)
  const originalCopy=new Uint8ClampedArray(f.original)
  const result=recoverMissedSkyMask(f.original,f.mask,false,{width:14,height:12,strength:3})
  assert.equal(f.get(result,7,3),255)
  assert.equal(f.get(result,8,3),0)
  assert.equal(f.get(result,11,10),0)
  assert.deepEqual(f.original,originalCopy)
})

test('does not eat bright windows or water outside the upper 64 percent',()=>{
  const f=fixture(18,16)
  for(let y=9;y<16;y++) for(let x=0;x<18;x++) f.pixel(x,y,[245,245,245],0)
  const result=recoverMissedSkyMask(f.original,f.mask,false,{width:18,height:16,strength:3})
  assert.equal(f.get(result,3,15),0,'bright water stays')
  assert.equal(f.get(result,0,15),0,'lower side edge is never seeded')
})

test('does not cross a dark barrier into enclosed bright building window',()=>{
  const f=fixture(16,16)
  for(let y=1;y<9;y++) for(let x=2;x<12;x++) f.pixel(x,y,[15,22,31],0)
  // Enclosed bright region could be a building window or facade.
  for(let y=3;y<6;y++) for(let x=5;x<8;x++) f.pixel(x,y,[245,245,245],0)
  const result=recoverMissedSkyMask(f.original,f.mask,false,{width:16,height:16,strength:3})
  assert.equal(f.get(result,6,4),0,'window behind dark wall stays foreground')
})

test('medium/high recover a faint patch that low should not',()=>{
  const f=fixture(12,12)
  for(let y=1;y<5;y++) for(let x=0;x<5;x++) f.pixel(x,y,[224,224,224],0)
  const low=recoverMissedSkyMask(f.original,f.mask,false,{width:12,height:12,strength:1})
  const medium=recoverMissedSkyMask(f.original,f.mask,false,{width:12,height:12,strength:2})
  const high=recoverMissedSkyMask(f.original,f.mask,false,{width:12,height:12,strength:3})
  assert.equal(f.get(low,1,2),0)
  assert.equal(f.get(medium,1,2),255)
  assert.equal(f.get(high,1,2),255)
})

test('off leaves mask unchanged including inversion and supports inverted AI masks',()=>{
  const f=fixture(10,10)
  for(let y=1;y<5;y++) for(let x=0;x<4;x++) f.pixel(x,y,[245,245,245],0)
  const off=recoverMissedSkyMask(f.original,f.mask,false,{width:10,height:10,strength:0})
  assert.deepEqual(off,f.mask)
  assert.notStrictEqual(off,f.mask)
  const reversed=new Uint8ClampedArray(f.mask)
  for(let i=0;i<reversed.length;i+=4) {
    reversed[i]=255-reversed[i]
    reversed[i+1]=255-reversed[i+1]
    reversed[i+2]=255-reversed[i+2]
  }
  const result=recoverMissedSkyMask(f.original,reversed,true,{width:10,height:10,strength:2})
  assert.equal(f.get(result,1,2),0,'inverted provider orientation is retained')
  const alpha=applySkyAlpha(f.original,result,true)
  assert.equal(alpha[(2*10+1)*4+3],0)
})

test('no trusted sky sample returns original mask instead of guessing',()=>{
  const f=fixture(6,6,[245,245,245],0)
  const result=recoverMissedSkyMask(f.original,f.mask,false,{width:6,height:6,strength:3})
  assert.deepEqual(result,f.mask)
})

test('rejects inconsistent dimensions and invalid strength',()=>{
  const f=fixture(8,8)
  assert.throws(()=>recoverMissedSkyMask(f.original,f.mask,false,{width:8,height:9,strength:2}),/dimensions/)
  assert.throws(()=>recoverMissedSkyMask(f.original,f.mask,false,{width:8,height:8,strength:5}),/strength/)
})

test('recovers cloud pocket enclosed by a one-pixel branch where flood fill cannot enter',()=>{
  const f=fixture(24,20)
  // Dense dark branch loop, completely separating this cloud from top sky.
  for(let y=3;y<=10;y++) for(let x=3;x<=13;x++){
    const border=y===3||y===10||x===3||x===13
    f.pixel(x,y,border?[36,42,45]:[245,245,246],0)
  }
  const before=recoverMissedSkyMask(f.original,f.mask,false,{width:24,height:20,strength:0})
  const after=recoverMissedSkyMask(f.original,f.mask,false,{width:24,height:20,strength:2})
  assert.equal(f.get(before,5,5),0,'raw model missed the enclosed cloud')
  assert.equal(f.get(after,5,5),255,'enclosed bright cloud is recovered')
  assert.equal(f.get(after,3,5),0,'dark enclosing branch stays foreground')
})
