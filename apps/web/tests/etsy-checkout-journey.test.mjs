import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {etsyListingForFinish,canContinueToEtsy,trustedEtsyListing,isSavedDesignId}
  from '../src/etsyCheckout.ts'
import {materialsForProductionJob} from '../src/orderFulfillment.ts'
import {makeOrderManifest} from '../src/orderManifest.ts'

const GOOD='SK-0123456789ABCDEF'
const design={moment:{date:'2026-06-16',time:'21:00',location:{displayName:'Joliet'}}}
const prefs={layout:'above',heading:180,pitch:18,fov:105,skyHeight:35,
  photoFit:'fit',tone:'natural',glow:true,finish:'walnut',inscription:''}
const manifest=makeOrderManifest(GOOD,design,prefs,
  {name:'photo.jpg',bytes:3,mime:'image/jpeg'},'2026-11-11T14:00:00Z')
const both={walnut:'https://www.etsy.com/listing/1234567890/walnut-frame',
  ebony:'https://www.etsy.com/listing/2345678901/matte-black-frame'}
test('only real Etsy listing URLs, not shops, redirects or arbitrary hosts',()=>{
  for(const url of [
    'https://www.etsy.com/shop/StarKeepsake','https://evil.com/listing/1234567',
    'https://www.etsy.com.evil.com/listing/1234567',
    'http://www.etsy.com/listing/1234567',
    'https://www.etsy.com/listing/0',
    'https://www.etsy.com/listing/1234567?checkout=1',
    'https://www.etsy.com/listing/1234567#key=SECRET',
    'https://admin:pass@www.etsy.com/listing/1234567',
  ])assert.equal(trustedEtsyListing(url),null,url)
  assert.equal(trustedEtsyListing(both.walnut),both.walnut)
  assert.equal(trustedEtsyListing('https://etsy.com/listing/1234567890/'),
    'https://www.etsy.com/listing/1234567890')
})
test('selected finish routes to the correct Etsy listing',()=>{
  const walnut=etsyListingForFinish('walnut',both)
  const black=etsyListingForFinish('ebony',both)
  assert.equal(walnut?.url,both.walnut)
  assert.equal(black?.url,both.ebony)
  assert.equal(walnut?.requiresFinishSelection,false)
  assert.equal(etsyListingForFinish('oak',both),null)
})
test('shared Etsy listing requires buyer reselecting the matching variation',()=>{
  const q=etsyListingForFinish('ebony',{shared:'https://www.etsy.com/listing/12345'})
  assert.ok(q?.requiresFinishSelection)
  assert.equal(q?.finish,'ebony')
  assert.equal(etsyListingForFinish('walnut',{}),null)
  assert.equal(etsyListingForFinish('walnut',{shared:'https://www.etsy.com/shop/whatever'}),null)
})
test('checkout never activates before a valid server saved SK design and matching packet',()=>{
  const listing=etsyListingForFinish('walnut',both)
  const check=(saved,ref,pkt,choice=listing)=>canContinueToEtsy({
    designSaved:saved,savedDesignId:ref,manifest:pkt,listing:choice
  })
  assert.equal(check(true,GOOD,manifest),true)
  assert.equal(check(false,GOOD,manifest),false)
  assert.equal(check(true,'SK-1234567890AB',manifest),false)
  assert.equal(check(true,GOOD,manifest,etsyListingForFinish('ebony',both)),false)
  assert.equal(check(true,GOOD,{...manifest,reference:'SK-1111111111111111'}),false)
  assert.equal(check(true,GOOD,null),false)
  assert.equal(check(true,GOOD,manifest,null),false)
  assert.equal(isSavedDesignId(GOOD),true)
  assert.equal(isSavedDesignId('SK-1234567890AB'),false)
})
const materials={shopId:1,parts:[{sku:'LED-WW',name:'Warm LEDs',unit:'each',
  on_hand:2,unit_cost_cents:300,supplier_name:null,supplier_url:null}],
  plans:[{shop_id:1,receipt_id:12,transaction_id:99,status:'draft'}],
  lines:[{shop_id:1,receipt_id:12,transaction_id:99,sku:'LED-WW',
    quantity_required:4}],
  purchases:[{purchase_id:'p',sku:'LED-WW',quantity_ordered:3,
    quantity_received:1,status:'partially_received',
    supplier_reference:'Amazon actual order',unit_cost_cents_snapshot:300}]
}
test('owner Etsy order panel shows job BOM and existing incoming orders',()=>{
  const r=materialsForProductionJob(materials,1,12,99)
  assert.equal(r.prepared,true)
  assert.deepEqual(r.rows[0].required,4)
  assert.deepEqual(r.rows[0].physicalOnHand,2)
  assert.deepEqual(r.rows[0].pendingFromSuppliers,2)
})
test('absent or foreign BOM is visibly blocked, not interpreted as no materials',()=>{
  assert.equal(materialsForProductionJob(materials,1,12,12).prepared,false)
  assert.equal(materialsForProductionJob(materials,2,12,99).prepared,false)
  assert.equal(materialsForProductionJob(null,1,12,99).prepared,false)
  const missing={...materials,parts:[]}
  assert.equal(materialsForProductionJob(missing,1,12,99).prepared,false)
})
test('customer builder and owner dashboard keep the linked journey',()=>{
  const source=readFileSync(new URL('../src/pages/ExperiencePage.tsx',import.meta.url),'utf8')
  const owner=readFileSync(new URL('../src/pages/ProductionDashboardPage.tsx',import.meta.url),'utf8')
  assert.match(source,/savedDesignId:receipt\.designId/)
  assert.match(source,/await saveDesignNow\(\)/)
  assert.match(source,/canContinueToEtsy/)
  assert.match(source,/Copy exact Design ID for Etsy/)
  assert.match(source,/currentOrder\.manifest\.reference/)
  assert.ok(!source.includes('verifiedEtsyLink'))
  assert.match(owner,/materialsForProductionJob/)
  assert.match(owner,/View combined Amazon shopping checklist/)
  assert.match(owner,/Match the saved frame finish to the variation/)
})
