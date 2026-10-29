import test from 'node:test'
import assert from 'node:assert/strict'
import { EXPLORER_LOCATIONS, orthographicProject, normalizedLongitude, clampLatitude } from '../src/skyExplorerData.ts'

test('orthographic Earth places selected geographic point at globe center',()=>{
  for(const loc of EXPLORER_LOCATIONS){
    const p=orthographicProject(loc.latitude,loc.longitude,loc.latitude,loc.longitude)
    assert.ok(Math.abs(p.x)<1e-9)
    assert.ok(Math.abs(p.y)<1e-9)
    assert.equal(p.visible,true)
    assert.ok(p.depth>0.999)
  }
})

test('opposite geographic point is hidden behind the globe',()=>{
  const front=orthographicProject(0,0,0,0)
  const rear=orthographicProject(0,180,0,0)
  assert.equal(front.visible,true)
  assert.equal(rear.visible,false)
})

test('east and north are correctly oriented in globe projection',()=>{
  assert.ok(orthographicProject(0,30,0,0).x>0)
  assert.ok(orthographicProject(30,0,0,0).y>0)
  assert.equal(normalizedLongitude(370),10)
  assert.equal(normalizedLongitude(-190),170)
  assert.equal(clampLatitude(91),82)
  assert.equal(clampLatitude(-91),-82)
})

test('example observer coordinates are physical Earth coordinates',()=>{
  for(const {latitude,longitude} of EXPLORER_LOCATIONS){
    assert.ok(latitude >= -90 && latitude <= 90)
    assert.ok(longitude >= -180 && longitude <= 180)
  }
})
