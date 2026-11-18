import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {DESIGN_RE,KEY_RE,NUMBER_RE,packetPath,checklistPrefix,STEP_IDS}
  from '../server/archiveAccess.js'
import {VERIFIED_LISTING_CANDIDATES,supplierCandidateFor}
  from '../src/supplierCandidates.ts'

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),'utf8')

test('Vercel functions use native Web Request and Response entrypoints',()=>{
  for(const file of ['freeze','archive','checklist']){
    const source=read('../api/production/'+file+'.js')
    assert.match(source,/export default \{fetch:handler\}/)
    assert.match(source,/authorize(CustomerDesign|OwnerJob)/)
    assert.doesNotMatch(source,/req\.query|res\.status|process\.env\.BLOB_READ_WRITE_TOKEN/)
  }
})
test('customer finalization is tied to a real server-issued SK design ID and secret',()=>{
  assert.equal(DESIGN_RE.test('SK-0123456789ABCDEF'),true)
  assert.equal(DESIGN_RE.test('TRIAL-NO-ETSY-PAYMENT'),false)
  assert.equal(KEY_RE.test('a'.repeat(43)),true)
  assert.equal(KEY_RE.test('short'),false)
  assert.equal(packetPath('SK-0123456789ABCDEF'),
    'production/designs/SK-0123456789ABCDEF/frozen-v1.zip')
})
test('owner checklist uses exact paid receipt and transaction namespaces',()=>{
  assert.equal(NUMBER_RE.test('1234567'),true)
  assert.equal(NUMBER_RE.test('0'),false)
  assert.equal(NUMBER_RE.test('../123'),false)
  assert.equal(STEP_IDS.size,23)
  assert.equal(checklistPrefix('123','456','SK-0123¶»§q«^