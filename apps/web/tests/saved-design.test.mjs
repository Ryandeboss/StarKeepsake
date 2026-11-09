import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseDesignLink, privateDesignLink, designSnapshotSignature,
} from '../src/savedDesign.ts'

const receipt = {designId:'SK-ABCDEF0123456789',accessKey:'A'.repeat(43)}
test('private restore link uses URL fragment not query or pathname', () => {
  const link=privateDesignLink('https://starkeepsake.vercel.app/?utm_source=example',receipt)
  const url=new URL(link)
  assert.equal(url.pathname,'/')
  assert.equal(url.search,'')
  assert.equal(url.searchParams.has('key'),false)
  assert.equal(parseDesignLink(url.hash)?.designId,receipt.designId)
  assert.equal(parseDesignLink(url.hash)?.accessKey,receipt.accessKey)
})
test('invalid short or forged links rejected', () => {
  assert.equal(parseDesignLink('#design=SK-1&key=short'),null)
  assert.equal(parseDesignLink('#design=SK-ABCDEF0123456789&key=123'),null)
  assert.equal(parseDesignLink('#other=yes'),null)
  assert.throws(()=>privateDesignLink('https://example.org', {designId:'SK-X',accessKey:'short'}))
})
test('changes to manufacturing preferences invalidate a saved snapshot',()=>{
  const design={designId:'draft',moment:{date:'2026-11-09'},stars:[{magnitude:1}]}
  const preferences={layout:'above',finish:'oak'}
  const a=designSnapshotSignature({design,preferences,photoBytes:100,prepared:false})
  const b=designSnapshotSignature({design:{...design,designId:'SK-ABCDEF0123456789'},preferences,
    photoBytes:100,prepared:false})
  const c=designSnapshotSignature({design,preferences:{...preferences,finish:'walnut'},
    photoBytes:100,prepared:false})
  assert.equal(a,b)
  assert.notEqual(a,c)
})
