import test from 'node:test'
import assert from 'node:assert/strict'
import { removeSkySpots } from '../src/skySpotCleanup.ts'
import { applySkyAlpha } from '../src/skyAiMask.ts'

function fixture(width, height) {
  const rgb=new Uint8ClampedArray(width*height*4)
  const mask=new Uint8ClampedArray(width*height*4)
  function pixel(x,y, color, sky) {
    const i=(y*width+x)*4
    rgb.set([...color,255],i)
    mask.set([sky,sky,sky,255],i)
  }
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) pixel(x,y,[244,246,249],255)
  const alpha=(arr,x,y)=>arr[(y*width+x)*4+3]
  const sky=(arr,x,y)=>arr[(y*width+x)*4]
  return {rgb,mask,pixel,alpha,sky}
}

test('click removes white tree holes but preserves thin black branches',()=>{
  const f=fixture(20,18)
  // A dark enclosing silhouette keeps both white pockets disconnected from
  // the already-segmented exterior sky, like a tree canopy branch loop.
  for(let y=1;y<=10;y++) for(let x=1;x<=12;x++) f.pixel(x,y,[32,38,41],0)
  for(let y=2;y<10;y++) for(let x=2;x<12;x++) f.pixel(x,y,[245,245,246],0)
  for(let y=2;y<10;y++) f.pixel(7,y,[33,35,36],0)
  const originalCopy=new Uint8ClampedArray(f.rgb)
  const modelCopy=new Uint8ClampedArray(f.mask)
  const output=removeSkySpots(f.rgb,f.mask,false,20,18,[{x:3,y:5}])
  assert.equal(f.sky(output,3,5),255,'clicked white pocket is sky')
  assert.equal(f.sky(output,10,5),0,'branch separates the two sky pockets')
  assert.equal(f.sky(output,7,5),0,'dark branch remains foreground')
  const composite=applySkyAlpha(f.rgb,output)
  assert.equal(f.alpha(composite,3,5),0)
  assert.equal(f.alpha(composite,7,5),255)
  assert.deepEqual(f.rgb,originalCopy)
  assert.deepEqual(f.mask,modelCopy)
})

test('second click resolves a disconnected bright tree gap without further model calls',()=>{
  const f=fixture(20,18)
  for(let y=1;y<=10;y++) for(let x=1;x<=12;x++) f.pixel(x,y,[29,36,40],0)
  for(let y=2;y<10;y++) for(let x=2;x<12;x++) f.pixel(x,y,[245,245,245],0)
  for(let y=2;y<10;y++) f.pixel(7,y,[29,36,40],0)
  const one=removeSkySpots(f.rgb,f.mask,false,20,18,[{x:3,y:5}])
  const two=removeSkySpots(f.rgb,f.mask,false,20,18,[{x:3,y:5},{x:10,y:5}])
  assert.equal(f.sky(one,10,5),0)
  assert.equal(f.sky(two,10,5),255)
  assert.equal(f.sky(two,7,5),0)
  // Undo means recomputing with the saved prior seed list.
  const undone=removeSkySpots(f.rgb,f.mask,false,20,18,[{x:3,y:5}])
  assert.equal(f.sky(undone,10,5),0)
})

test('cannot erase dark buildings, bright lower water, or trees with a bad click',()=>{
  const f=fixture(20,20)
  for(let y=2;y<12;y++) for(let x=8;x<15;x++) f.pixel(x,y,[30,38,43],0)
  for(let y=14;y<20;y++) for(let x=0;x<20;x++) f.pixel(x,y,[235,237,238],0)
  const output=removeSkySpots(f.rgb,f.mask,false,20,20,[
    {x:9,y:5}, // dark building - ignored
    {x:12,y:18}, // bright lower image - ignored
  ])
  assert.deepEqual(output,f.mask)
})

test('inverted mask stays in provider orientation and clearing spots is reversible',()=>{
  const f=fixture(12,12)
  for(let y=2;y<7;y++) for(let x=0;x<4;x++) f.pixel(x,y,[247,247,248],0)
  const inverted=new Uint8ClampedArray(f.mask)
  for(let i=0;i<inverted.length;i+=4){
    inverted[i]=255-inverted[i]
    inverted[i+1]=255-inverted[i+1]
    inverted[i+2]=255-inverted[i+2]
  }
  const output=removeSkySpots(f.rgb,inverted,true,12,12,[{x:2,y:4}])
  assert.equal(f.sky(output,2,4),0)
  assert.deepEqual(removeSkySpots(f.rgb,inverted,true,12,12,[]),inverted)
})

test('rejects inconsistent pixel dimensions',()=>{
  const f=fixture(10,10)
  assert.throws(()=>removeSkySpots(f.rgb,f.mask,false,11,10,[]),/dimensions/)
})

test('manual spot can reach the bottom half when lower-image protection is off',()=>{
  const f=fixture(24,30)
  // Simulate a portrait canopy where a bright sky pocket lies near the bottom.
  for(let y=23;y<28;y++) for(let x=4;x<10;x++)
    f.pixel(x,y,[247,247,249],0)
  for(let y=23;y<28;y++) f.pixel(7,y,[31,37,40],0)
  const seed=[{x:5,y:25}]
  const guarded=removeSkySpots(f.rgb,f.mask,false,24,30,seed)
  const full=removeSkySpots(f.rgb,f.mask,false,24,30,seed,false)
  assert.equal(f.sky(guarded,5,25),0,'default protects lower portrait area')
  assert.equal(f.sky(full,5,25),255,'manual override removes lower sky gap')
  assert.equal(f.sky(full,7,25),0,'dark branch in lower image is protected')
  const restored=removeSkySpots(f.rgb,f.mask,false,24,30,[],false)
  assert.equal(f.sky(restored,5,25),0,'removing edits restores original mask')
})
