import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import phases from '../src/rehearsalPhases.json' with {type:'json'}
import {zipFiles} from '../src/orderManifest.ts'
import {readFrozenMakerPacket} from '../src/frozenMakerReader.ts'
const raw=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const SK='SK-0123456789ABCDEF'
const enc=new TextEncoder()

test('frozen packet carries exact snapshot, real Design ID and three print variants',async()=>{
  const manifest={reference:SK,status:'UNPAID_PREVIEW',manufacturing:{
    candidatePlan:{version:'maker-v1'},selectedPhysicalStars:2,
  }}
  const plan={designId:SK,version:'maker-v1',physicalCount:2,
    stars:[{ledIndex:0},{ledIndex:1}]}
  const items=[
    ['order.json',JSON.stringify(manifest)],
    ['manufacturing-job-plan.json',JSON.stringify(plan)],
    ['order-sheet.png','fake-png-content'],
  ]
  for(const id of [
    ['exact','print-artwork-exact-11x14.png','print-spec-exact.json','print-guide-exact.svg'],
    ['eighth','print-artwork-bleed-1-8.png','print-spec-bleed-1-8.json','print-guide-bleed-1-8.svg'],
    ['quarter','print-artwork-bleed-1-4.png','print-spec-bleed-1-4.json','print-guide-bleed-1-4.svg'],
  ])for(const name of id.slice(1))items.push([name,name])
  const zip=new Blob([zipFiles(items.map(([name,content])=>({
    name,data:enc.encode(content)
  })))],{type:'application/zip'})
  const frozen=await readFrozenMakerPacket(zip,SK)
  assert.equal(frozen.manifest.reference,SK)
  assert.equal(frozen.plan.designId,SK)
  assert.equal(frozen.plan.physicalCount,2)
  assert.equal(frozen.files['order-sheet.png'].type,'image/png')
  assert.ok(frozen.files['print-artwork-bleed-1-4.png'])
  await assert.rejects(()=>readFrozenMakerPacket(zip,'SK-1111111111111111'),/Design ID/)
})
test('rehearsal includes every phase with unique per-job IDs',()=>{
  assert.equal(phases.phases.length,14)
  const ids=phases.phases.flatMap(x=>x.steps.map(s=>s.id))
  assert.ok(ids.length>=100)
  assert.equal(new Set(ids).size,ids.length)
  assert.ok(phases.phases.every(p=>p.steps.length>=5))
})
test('server isolates per-step, part, print and evidence states, with physical hold gates',()=>{
  const server=raw('../api/production/simulate.js')
  for(const x of ['authorizeOwner(request)','frozenPath(body.designId)',
    'n>24','view===\'work\'','kind===\'step\'','kind===\'part\'',
    'kind===\'evidence\'','kind===\'print\'','kind===\'complete\'',
    'completionBlockers','readyToBuild','await del([pathFor(id),'])assert.ok(server.includes(x),x)
  assert.match(server,/production\/simulations\/work\//)
  assert.match(server,/SIMULATED_NOT_PAID/)
  assert.doesNotMatch(server,/etsy\.com|etsy\/orders|api\/webhooks\/etsy/)
})
test('admin uses frozen manufacturer plan, not new star or print algorithm',()=>{
  const owner=raw('../src/pages/OwnerProductionFiles.tsx')
  const maker=raw('../src/pages/OwnerManufacturingPlan.tsx')
  const builder=raw('../src/customerOrder.ts')
  assert.match(owner,/readFrozenMakerPacket/)
  assert.match(owner,/simulated\)return frozenLoaded\?\.plan\?\?null/)
  assert.match(owner,/FILES FOR THIS BUILD/)
  assert.match(owner,/Original frozen/)
  assert.match(maker,/RehearsalWorkbench/)
  assert.match(builder,/designId:reference/)
})
test('trusted sources never masquerade as build approval; stale BOM retired',()=>{
  const src=raw('../src/supplierCandidates.ts')
  const legacy=JSON.parse(raw('../../../docs/manufacturing/candidate-bom.json'))
  assert.match(src,/sourceConfidence/)
  assert.match(src,/buildValidation:'Research Candidate'/)
  assert.match(src,/curbellplastics.com/)
  assert.match(src,/adafruit.com\/product\/5648/)
  assert.equal(legacy.deprecated,true)
  assert.match(legacy.deprecatedReason,/WS2812B/)
})
