import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildManualBuyingQueue,amazonProductUrl,amazonSearchUrl}
  from '../src/manualAmazonQueue.ts'

const receipt=(id=10,overrides={})=>({
  shop_id:1,receipt_id:id,etsy_status:'paid',is_paid:true,
  is_canceled:false,has_refunds:false,...overrides
})
const item=(id=10,txn=100,overrides={})=>({
  shop_id:1,receipt_id:id,transaction_id:txn,quantity:1,
  match_state:'matched',design_id:'design-1',title:'Custom StarKeepsake',...overrides
})
const job=(id=10,txn=100,overrides={})=>({
  shop_id:1,receipt_id:id,transaction_id:txn,design_id:'design-1',
  status:'awaiting_review',...overrides
})
const plan=(id=10,txn=100,overrides={})=>({
  shop_id:1,receipt_id:id,transaction_id:txn,status:'draft',...overrides
})
const line=(id=10,txn=100,required=5,overrides={})=>({
  shop_id:1,receipt_id:id,transaction_id:txn,sku:'LED-WARM',
  quantity_required:required,...overrides
})
const part=(overrides={})=>({
  sku:'LED-WARM',name:'Warm-white LEDs',unit:'each',on_hand:1,
  unit_cost_cents:200,supplier_name:null,supplier_url:null,...overrides
})
const mapping=(overrides={})=>({
  sku:'LED-WARM',asin:'B001ABC123',pack_quantity:2,enabled:true,...overrides
})
const input=()=>({
  etsy:{shopId:1,receipts:[receipt()],items:[item()],jobs:[job()]},
  m3:{shopId:1,parts:[part()],plans:[plan()],lines:[line()],
    purchases:[{purchase_id:'p-1',sku:'LED-WARM',status:'partially_received',
      quantity_ordered:2,quantity_received:1,supplier_reference:'Amazon order A',
      unit_cost_cents_snapshot:200}]},
  m6:{mappings:[mapping()]}
})
const run=v=>buildManualBuyingQueue(v.etsy,v.m3,v.m6)

test('verified paid matched Etsy job gives manual shortage and saved ASIN link',()=>{
  const q=run(input())
  assert.equal(q.paidReceipts,1)
  assert.equal(q.eligibleJobs,1)
  assert.equal(q.complete,true)
  assert.equal(q.realCheckoutEnabled,false)
  assert.deepEqual([q.parts[0].required,q.parts[0].onHand,q.parts[0].pending,
    q.parts[0].shortage,q.parts[0].additionalNeeded,q.parts[0].estimatedPacks],
  [5,1,1,4,3,2])
  assert.equal(q.parts[0].url,'https://www.amazon.com/dp/B001ABC123')
  assert.equal(q.parts[0].lookup,'mapped_asin')
})
test('unpaid, canceled, refunded, incomplete Etsy receipts produce no buy list',()=>{
  for(const overrides of [
    {is_paid:false,etsy_status:'open'}, {is_canceled:true},
    {has_refunds:true}, {etsy_status:'refunded'}
  ]){
    const v=input();v.etsy.receipts=[receipt(10,overrides)]
    const q=run(v)
    assert.equal(q.paidReceipts,0)
    assert.equal(q.parts.length,0)
  }
})
test('uncertain design, quantity not one, or invalid job is held for review',()=>{
  for(const change of [
    {match_state:'ambiguous'}, {quantity:2},{design_id:null}
  ]){
    const v=input();v.etsy.items=[item(10,100,change)]
    const q=run(v)
    assert.equal(q.parts.length,0);assert.equal(q.review.length,1)
    assert.equal(q.complete,false)
  }
  const v=input();v.etsy.jobs=[job(10,100,{design_id:'other'})]
  assert.equal(run(v).review.length,1)
})
test('paid order without BOM produces actionable warning, not an empty all-clear',()=>{
  const v=input();v.m3.plans=[]
  const q=run(v)
  assert.equal(q.eligibleJobs,1)
  assert.equal(q.unplanned.length,1)
  assert.equal(q.parts.length,0)
  assert.equal(q.complete,false)
  assert.match(q.warnings.join(' '),/lacks a complete BOM/)
})
test('in-progress eligible job counts but held/complete jobs do not',()=>{
  const v=input();v.etsy.jobs=[job(10,100,{status:'in_progress'})]
  assert.equal(run(v).parts.length,1)
  for(const status of ['hold','complete']){
    v.etsy.jobs=[job(10,100,{status})]
    assert.equal(run(v).parts.length,0)
  }
})
test('multiple paid jobs accumulate demand; incoming orders reduce new demand',()=>{
  const v=input()
  v.etsy.receipts.push(receipt(11));v.etsy.items.push(item(11,101))
  v.etsy.jobs.push(job(11,101));v.m3.plans.push(plan(11,101))
  v.m3.lines.push(line(11,101,3))
  const q=run(v)
  assert.deepEqual([q.parts[0].required,q.parts[0].shortage,
    q.parts[0].additionalNeeded,q.parts[0].estimatedPacks],[8,7,6,3])
})
test('open supplier orders prevent double-buy of recorded quantities',()=>{
  const v=input()
  v.m3.purchases[0].quantity_ordered=6
  v.m3.purchases[0].quantity_received=1
  const q=run(v)
  assert.equal(q.parts[0].additionalNeeded,0)
  assert.equal(q.parts[0].estimatedPacks,null)
})
test('missing Amazon mapping produces search link and no invented ASIN',()=>{
  const v=input();v.m6.mappings=[]
  const q=run(v)
  assert.equal(q.parts[0].lookup,'amazon_search')
  assert.equal(q.parts[0].asin,null)
  assert.equal(q.parts[0].estimatedPacks,null)
  assert.equal(q.parts[0].url,amazonSearchUrl('Warm-white LEDs'))
  assert.match(q.parts[0].warnings.join(' '),/not verified/)
})
test('invalid ASIN and suspicious-looking names cannot become external URLs',()=>{
  assert.equal(amazonProductUrl('http://evil'),null)
  assert.equal(amazonProductUrl('B001ABC123'),'https://www.amazon.com/dp/B001ABC123')
  const name='LED & <script>alert(1)</script>'
  const url=amazonSearchUrl(name)
  assert.ok(url.startsWith('https://www.amazon.com/s?k='))
  assert.ok(!url.includes('<script>'))
  assert.equal(decodeURIComponent(url.split('k=')[1]),name)
})
test('truncated source or mismatched shop prevents complete recommendation',()=>{
  const v=input();v.etsy.shopId=2
  assert.equal(run(v).complete,false)
  const v2=input();v2.etsy.receipts=Array(100).fill(receipt())
  assert.equal(run(v2).complete,false)
})
test('Studio uses manual log endpoint and has no supplier checkout code',()=>{
  const page=readFileSync(new URL('../src/pages/ProductionDashboardPage.tsx',import.meta.url),'utf8')
  const panel=readFileSync(new URL('../src/pages/ManualAmazonPurchasingPanel.tsx',import.meta.url),'utf8')
  assert.match(page,/ManualAmazonPurchasingPanel adminKey=/)
  assert.match(panel,/\/api\/admin\/materials\/purchases/)
  assert.match(panel,/confirmPlaced/)
  assert.match(panel,/onClick=.*choose/)
  assert.match(panel,/every two minutes/)
  assert.ok(!panel.includes('AmazonBusinessOrderPlacement'))
  assert.ok(!panel.includes('/ordering/2022-10-30/orders'))
  assert.ok(!panel.includes('placeOrder('))
  assert.match(panel,/\/api\/admin\/production\/orders/)
})
