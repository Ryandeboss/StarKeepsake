import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DESIGN_RE,KEY_RE,NUMBER_RE,frozenPath,
  checklistPrefix,STEP_IDS} from '../server/archiveAccess.js'
import {SUPPLIER_CANDIDATES,supplierCandidateFor} from '../src/supplierCandidates.ts'
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')

test('immutable archived ZIP path is tied to server SK-ID and has no public access',()=>{
  assert.equal(DESIGN_RE.test('SK-0123456789ABCDEF'),true)
  assert.equal(DESIGN_RE.test('TRIAL-NO-ETSY-PAYMENT'),false)
  assert.equal(KEY_RE.test('a'.repeat(43)),true)
  assert.equal(KEY_RE.test('tiny'),false)
  assert.equal(frozenPath('SK-0123456789ABCDEF'),
    'production/designs/SK-0123456789ABCDEF/frozen-v1.zip')
  const source=read('../api/production/freeze.js')
  assert.match(source,/allowedContentTypes:\['application\/zip'\]/)
  assert.match(source,/allowOverwrite:false/)
  assert.match(source,/await authorizeDesign/)
  assert.match(source,/onUploadCompleted/)
  assert.match(read('../src/frozenPacket.ts'),/access:'private'/)
})

test('original ZIP must be frozen before Etsy-ready state is displayed',()=>{
  const app=read('../src/pages/ExperiencePage.tsx')
  const freeze=app.indexOf('withDeadline(freezeManufacturingPacket(receipt,packet)')
  const ready=app.indexOf('setPreparedOrder({key,packet})')
  assert.ok(freeze>0 && ready>freeze)
  assert.match(app,/physical LED stars are frozen in your manufacturing files/)
  assert.match(app,/Download complete design backup \(ZIP\)/)
  assert.doesNotMatch(app,/etsyDesignCardFilename|Download design card again/)
  assert.match(app,/Copy my Design ID/)
  assert.match(app,/Continue to Etsy/)
})

test('checklist is 23 paid-job-scoped durable records, not browser localStorage',()=>{
  assert.equal(STEP_IDS.size,23)
  assert.equal(NUMBER_RE.test('17'),true)
  assert.equal(NUMBER_RE.test('../etc'),false)
  assert.equal(checklistPrefix('17','42','SK-0123456789ABCDEF'),
    'production/checklists/17/42/SK-0123456789ABCDEF/')
  const code=read('../api/production/checklist.js')
  const ui=read('../src/pages/OwnerManufacturingPlan.tsx')
  assert.match(code,/await authorizePaidJob/)
  assert.match(code,/allowOverwrite:true/)
  assert.match(ui,/serverReady/)
  assert.match(ui,/updateStep/)
  assert.doesNotMatch(ui,/localStorage/)
})
test('owner must verify matched paid Etsy item before Blob read/write',()=>{
  const auth=read('../server/archiveAccess.js')
  assert.match(auth,/\/api\/admin\/production\/jobs\//)
  assert.match(auth,/\/api\/admin\/production\/orders/)
  assert.match(auth,/awaiting_review/)
  const file=read('../api/production/archive.js')
  assert.match(file,/authorizePaidJob/)
  assert.match(file,/get\(pathname,\{access:'private'/)
  assert.match(file,/privateHeaders/)
})

test('no anonymous request can access any storage function',async()=>{
  const freeze=(await import('../api/production/freeze.js')).default
  const archive=(await import('../api/production/archive.js')).default
  const checklist=(await import('../api/production/checklist.js')).default
  const samples=[
    [freeze,'/api/production/freeze?designId=SK-0123456789ABCDEF'],
    [archive,'/api/production/archive?receiptId=77&transactionId=88'],
    [checklist,'/api/production/checklist?receiptId=77&transactionId=88'],
  ]
  for(const [handler,path] of samples){
    const response=await handler.fetch(new Request('https://example.invalid'+path))
    assert.equal(response.status,401)
    assert.equal(response.headers.get('Cache-Control'),'private, no-store')
  }
  const response=await checklist.fetch(new Request('https://example.invalid'+samples[2][1],{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({stepId:'frame',checked:true}),
  }))
  assert.equal(response.status,401)
})

test('Vite SPA routing excludes Vercel production endpoints',()=>{
  const route=JSON.parse(read('../vercel.json'))
  assert.equal(route.rewrites[0].source,'/api/:path*')
  assert.equal(route.rewrites[0].destination,'/api/:path*')
})
test('supplier research never implies validated stock or power safety',()=>{
  assert.ok(SUPPLIER_CANDIDATES.length>=8)
  assert.ok(SUPPLIER_CANDIDATES.every(s=>s.status==='LISTED_NOT_BUILD_VALIDATED'&&
    new URL(s.url).protocol==='https:'))
  assert.match(supplierCandidateFor('star_led')?.product??'',/LED3FWAW/)
  assert.equal(supplierCandidateFor('wall_power'),null)
  assert.equal(supplierCandidateFor('fuse'),null)
})

test('owner-only simulated orders cannot be created, listed or deleted anonymously',async()=>{
  const simulator=(await import('../api/production/simulate.js')).default
  const url='https://example.invalid/api/production/simulate'
  for(const [method,query] of [['GET',''],['DELETE','?designId=SK-0123456789ABCDEF']]){
    const res=await simulator.fetch(new Request(url+query,{method}))
    assert.equal(res.status,401)
    assert.equal(res.headers.get('Cache-Control'),'private, no-store')
  }
  const noOwner=await simulator.fetch(new Request(url,{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({designId:'SK-0123456789ABCDEF',accessKey:'a'.repeat(43)})}))
  assert.equal(noOwner.status,401)
})
test('test purchases require owner key, actual saved design and already frozen archive',()=>{
  const server=read('../api/production/simulate.js')
  const auth=read('../server/archiveAccess.js')
  assert.match(server,/await authorizeOwner\(request\)/)
  assert.match(server,/await authorizeDesign\(body\.designId,body\.accessKey\)/)
  assert.match(server,/findBlob\(frozenPath\(body\.designId\)\)/)
  assert.match(server,/status:'SIMULATED_NOT_PAID'/)
  assert.match(server,/production\/simulations\/orders\//)
  assert.match(server,/STEP_IDS/)
  assert.match(server,/view==='checklist'/)
  assert.match(server,/await del\(\[pathFor\(id\),/)
  assert.match(server,/DO NOT delete the saved design/)
  assert.doesNotMatch(server,/api\/admin\/production\/sync|api\/webhooks\/etsy/)
  assert.match(auth,/export async function authorizeOwner/)
  assert.match(auth,/\/api\/admin\/designs/)
})
test('real Etsy authorization and simulated checklist use distinct validated paths',()=>{
  const original=read('../src/pages/OwnerProductionFiles.tsx')
  const plan=read('../src/pages/OwnerManufacturingPlan.tsx')
  const dash=read('../src/pages/ProductionDashboardPage.tsx')
  assert.match(original,/simulated=false/)
  assert.match(original,/simulationUrl\+'\&view=design'/)
  assert.match(original,/simulationUrl\+'\&view=archive'/)
  assert.match(original,/URL\.createObjectURL\(prepared\.sheet\)/)
  assert.match(plan,/simulated=false/)
  assert.match(plan,/view=checklist/)
  assert.match(plan,/await fetch\(endpoint/)
  assert.match(dash,/Your simulated purchases/)
  assert.match(dash,/deleteTestOrder/)
  assert.match(dash,/simulated materials=\{materials\}/)
  assert.match(dash,/setTestOrders\(orders=>orders\.filter/)
  assert.match(dash,/purchasedDesigns=useMemo/)
})

test('simulated order supports fast owner authentication and per-ID reconciliation',()=>{
  const server=read('../api/production/simulate.js')
  const ui=read('../src/pages/ExperiencePage.tsx')
  assert.match(server,/view==='auth'/)
  assert.match(server,/authorized:true/)
  assert.match(server,/request.method==='GET'&&!view/)
  assert.match(server,/order:publicOrder\(record\)/)
  assert.match(ui,/Checking owner access/)
  assert.match(ui,/withDeadline\(getFrozenStatus/)
  assert.match(ui,/encodeURIComponent\(receipt\.designId\)/)
  assert.doesNotMatch(server,/\/api\/admin\/production\/sync/)
})
