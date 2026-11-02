import test from 'node:test'
import assert from 'node:assert/strict'
import { removeSkySweeps } from '../src/skySweepCleanup.ts'
import { applySkyAlpha } from '../src/skyAiMask.ts'

function fixture(width=28,height=20) {
  const original = new Uint8ClampedArray(width * height * 4)
  const mask = new Uint8ClampedArray(width * height * 4)
  function pixel(x,y,color,sky=0) {
    const i=(y*width+x)*4
    original.set([...color,255],i)
    mask.set([sky,sky,sky,255],i)
  }
  for (let y=0;y<height;y++) for(let x=0;x<width;x++)
    pixel(x,y,[34,44,48],0)
  const get=(arr,x,y)=>(arr[(y*width+x)*4])
  return {original,mask,pixel,get,width,height}
}

test('a single rectangle cleans many disconnected white pockets, preserving branch pixels',()=>{
  const f=fixture()
  for (let x=2;x<=6;x++) for(let y=2;y<=5;y++) f.pixel(x,y,[241,242,244])
  for (let x=9;x<=12;x++) for(let y=2;y<=5;y++) f.pixel(x,y,[230,233,238])
  for (let x=15;x<=19;x++) for(let y=2;y<=5;y++) f.pixel(x,y,[239,240,245])
  const source=new Uint8ClampedArray(f.original)
  const provider=new Uint8ClampedArray(f.mask)
  const output=removeSkySweeps(f.original,f.mask,false,f.width,f.height,[{x0:1,y0:1,x1:21,y1:7}])
  assert.equal(f.get(output,3,3),255)
  assert.equal(f.get(output,10,3),255)
  assert.equal(f.get(output,17,3),255)
  assert.equal(f.get(output,7,3),0,'dark branch between pockets remains')
  assert.equal(f.get(output,13,3),0,'second thin branch remains')
  assert.deepEqual(f.original,source,'photo RGB unchanged')
  assert.deepEqual(f.mask,provider,'provider mask unchanged')
  const final=applySkyAlpha(f.original,output)
  assert.equal(final[(3*f.width+10)*4+3],0)
  assert.equal(final[(3*f.width+7)*4+3],255)
})

test('sweep edits pixels only inside the dragged rectangle, even if pockets continue outside',()=>{
  const f=fixture()
  for(let y=2;y<6;y++) for(let x=2;x<24;x++) f.pixel(x,y,[245,246,248])
  const out=removeSkySweeps(f.original,f.mask,false,f.width,f.height,[{x0:3,y0:2,x1:13,y1:6}])
  assert.equal(f.get(out,4,3),255)
  assert.equal(f.get(out,12,3),255)
  assert.equal(f.get(out,13,3),0,'right boundary is exclusive')
  assert.equal(f.get(out,2,3),0,'left boundary protected')
  assert.equal(f.get(out,21,3),0,'sky-like pixels outside box unchanged')
})

test('sky sweep never edits protected water / lower photo',()=>{
  const f=fixture(20,20)
  for(let y=13;y<20;y++) for(let x=0;x<20;x++) f.pixel(x,y,[245,245,247])
  const out=removeSkySweeps(f.original,f.mask,false,20,20,[{x0:0,y0:0,x1:20,y1:20}])
  assert.equal(f.get(out,5,17),0)
  assert.equal(f.get(out,5,13),0)
})

test('dark twigs, tinted facades, bright isolated noise remain foreground',()=>{
  const f=fixture()
  for(let y=2;y<=7;y++) f.pixel(10,y,[21,29,34])
  for(let y=2;y<=7;y++) f.pixel(14,y,[100,168,225])
  f.pixel(17,3,[250,250,249]) // isolated high-brightness pixel
  const out=removeSkySweeps(f.original,f.mask,false,f.width,f.height,[{x0:1,y0:1,x1:22,y1:9}])
  assert.equal(f.get(out,10,4),0)
  assert.equal(f.get(out,14,4),0)
  assert.equal(f.get(out,17,3),0)
})

test('reversed coordinates, inverted model mask and undo by omitting last sweep',()=>{
  const f=fixture(24,20)
  for(let x=3;x<7;x++) for(let y=2;y<6;y++) f.pixel(x,y,[243,243,246])
  for(let x=15;x<19;x++) for(let y=2;y<6;y++) f.pixel(x,y,[243,243,246])
  const inverted=new Uint8ClampedArray(f.mask)
  for(let p=0;p<inverted.length;p+=4){
    inverted[p]=255-inverted[p]
    inverted[p+1]=255-inverted[p+1]
    inverted[p+2]=255-inverted[p+2]
  }
  const rect1={x0:9,y0:7,x1:1,y1:1}
  const rect2={x0:14,y0:1,x1:22,y1:7}
  const both=removeSkySweeps(f.original,inverted,true,24,20,[rect1,rect2])
  assert.equal(f.get(both,5,4),0)
  assert.equal(f.get(both,16,4),0)
  const undo=removeSkySweeps(f.original,inverted,true,24,20,[rect1])
  assert.equal(f.get(undo,5,4),0)
  assert.equal(f.get(undo,16,4),255,'undo restores second sweep original mask')
  assert.deepEqual(removeSkySweeps(f.original,inverted,true,24,20,[]),inverted)
})

test('invalid dimensions throw; out-of-bounds rectangle is safely clipped',()=>{
  const f=fixture(10,10)
  assert.throws(()=>removeSkySweeps(f.original,f.mask,false,10,11,[]),/dimensions/)
  f.pixel(1,1,[245,245,245])
  f.pixel(1,2,[245,245,245])
  const out=removeSkySweeps(f.original,f.mask,false,10,10,[{x0:-500,y0:-10,x1:4,y1:4}])
  assert.equal(f.get(out,1,1),255)
})
