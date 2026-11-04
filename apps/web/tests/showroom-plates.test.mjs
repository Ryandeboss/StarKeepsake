import test from 'node:test'
import assert from 'node:assert/strict'
import {SHOWROOM_PLATES} from '../src/components/HomeShowroomOptions.ts'
import {mapUnitToQuad,sceneQuadMatrix,quadAspect,artworkFit}
  from '../src/showroomProjection.ts'
import {removeGreenScreen} from '../src/showroomMatte.ts'
test('all uploaded green-screen plates have usable projective corners',()=>{
  assert.equal(Object.keys(SHOWROOM_PLATES).length,9)
  for(const plate of Object.values(SHOWROOM_PLATES)){
    assert.ok(plate.path.startsWith('/showroom/'))
    const points=[[0,0],[1,0],[1,1],[0,1]]
    for(let i=0;i<4;i++){
      const mapped=mapUnitToQuad(plate.quad,...points[i])
      const target=plate.quad[i]
      assert.ok(Math.abs(mapped[0]-target[0])<1e-7,`x corner ${plate.label} ${i}`)
      assert.ok(Math.abs(mapped[1]-target[1])<1e-7,`y corner ${plate.label} ${i}`)
    }
    assert.ok(quadAspect(plate.quad,plate.width,plate.height)>.4)
    assert.ok(sceneQuadMatrix(plate.quad,720,720*plate.height/plate.width).startsWith('matrix3d('))
  }
})
test('portrait compositions are never horizontally stretched to fill a wide plate',()=>{
  const fit=artworkFit(.62,1.60)
  assert.ok(fit.widthPercent<40)
  assert.equal(fit.heightPercent,100)
  const wide=artworkFit(1.8,.65)
  assert.equal(wide.widthPercent,100)
  assert.ok(wide.heightPercent<40)
  assert.equal(artworkFit(1.5,1.5).letterboxed,false)
})
test('chroma removal only removes the plate green and immediate spill, not wood',()=>{
  const src=new Uint8ClampedArray([
    100,61,32,255, 0,255,0,255, 0,255,0,255,
    87,67,49,255, 70,235,79,255, 89,78,63,255,
    51,70,38,255, 8,245,11,255, 70,70,65,255,
  ])
  const copy=new Uint8ClampedArray(src)
  const out=removeGreenScreen(src,3,3)
  assert.equal(out[3],255)
  assert.equal(out[7],0)
  assert.equal(out[19],0)
  assert.equal(out[35],255)
  assert.deepEqual([...src],[...copy],'source pixels must not mutate')
})
test('malformed plate geometry and pixel buffers fail closed',()=>{
  assert.throws(()=>removeGreenScreen(new Uint8ClampedArray(3),4,4),/Invalid plate/)
  assert.equal(sceneQuadMatrix(SHOWROOM_PLATES.warm.quad,0,100),'none')
})
