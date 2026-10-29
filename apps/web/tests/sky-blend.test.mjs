import test from 'node:test'
import assert from 'node:assert/strict'
import { skyCoverage, isSkyPixel, hasClearSkyAt, selectSkyBlendPoints } from '../src/skyBlendMath.ts'

const skyColor = [6,230,230]
function maskWithSky(rows=10,cols=10,skyRows=6) {
  const map = new Uint8ClampedArray(rows * cols * 4)
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const i=(y*cols+x)*4
      const isSky=y<skyRows
      map[i]=isSky?skyColor[0]:50
      map[i+1]=isSky?skyColor[1]:80
      map[i+2]=isSky?skyColor[2]:30
      map[i+3]=255
    }
  }
  return { width:cols,height:rows,segmentationMap:map,skyColor }
}
const region={xMm:5,yMm:5,widthMm:200,heightMm:100,label:'sky'}
const star=(xMm,yMm,hipparcosId)=>({
 xMm,yMm,hipparcosId,magnitude:2,altitudeDeg:60,azimuthDeg:0,holeSizeMm:1.2,ledIndex:1,
})

test('sky coverage counts detected pixels, never the photograph subject',()=>{
  const mask=maskWithSky(10,10,6)
  assert.equal(skyCoverage(mask),0.6)
  assert.equal(isSkyPixel(mask,0.5,0.2),true)
  assert.equal(isSkyPixel(mask,0.5,0.8),false)
  assert.equal(isSkyPixel(mask,-0.01,0.2),false)
  assert.equal(isSkyPixel(mask,0.2,1.01),false)
})

test('foreground stars and boundary stars are never drawn',()=>{
  const mask=maskWithSky(20,20,12)
  const stars=[
    star(105,35,101), // well inside sky
    star(105,95,102), // foreground
    star(105,64,103), // at sky boundary
  ]
  const selected=selectSkyBlendPoints(stars,region,mask)
  assert.deepEqual(selected.map(x=>x.star.hipparcosId),[101])
  assert.equal(hasClearSkyAt(mask,0.5,0.5),true)
  assert.equal(hasClearSkyAt(mask,0.5,0.95),false)
})

test('no recognised sky never creates fake placement',()=>{
 const mask=maskWithSky(12,12,0)
 assert.equal(skyCoverage(mask),0)
 assert.deepEqual(selectSkyBlendPoints([star(100,30,201)],region,mask),[])
})
