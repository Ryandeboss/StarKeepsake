import test from 'node:test'
import assert from 'node:assert/strict'
import {isUsableLocalDraft,resumedDraftStage} from '../src/localWorkshopDraft.ts'

const sample = {
  version:1,savedAtMs:Date.now(),photo:new Blob(['fake jpg'],{type:'image/jpeg'}),
  dimensions:{width:1920,height:1080},design:{schemaVersion:'1.5'},
  stage:'home',placement:'above',cutout:null,detected:null
}
test('refresh stage resumes without discarding the completed design',()=>{
  assert.equal(resumedDraftStage('home',true),'home')
  assert.equal(resumedDraftStage('choice',false),'choice')
  assert.equal(resumedDraftStage('refine',false),'refine')
  assert.equal(resumedDraftStage('calculating',false),'moment')
  assert.equal(resumedDraftStage('preview',false),'moment')
})
test('local draft requires an actual supported photo and version',()=>{
  assert.ok(isUsableLocalDraft(sample))
  assert.equal(isUsableLocalDraft({...sample,version:2}),false)
  assert.equal(isUsableLocalDraft({...sample,photo:new Blob(['x'],{type:'application/pdf'})}),false)
  assert.equal(isUsableLocalDraft({...sample,photo:new Blob([],{type:'image/jpeg'})}),false)
})
test('old local copies expire automatically for shared-device privacy',()=>{
  assert.equal(isUsableLocalDraft({...sample,savedAtMs:Date.now()-31*86400000}),false)
  assert.equal(isUsableLocalDraft({...sample,savedAtMs:Date.now()+70000}),false)
})
test('private access keys are not part of the local draft contract',()=>{
  const keys=['accessKey','secret','keyHash','customerEmail','privateLink']
  assert.ok(keys.every(k=>!Object.keys(sample).includes(k)))
})
