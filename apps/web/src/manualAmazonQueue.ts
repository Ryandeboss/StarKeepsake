// Manual Amazon sourcing for verified, already-imported Etsy orders.
// NO Amazon API, no checkout, no provider prices, no automatic purchase.
export type EtsyReceipt = {
  shop_id:number;receipt_id:number;etsy_status:string;is_paid:boolean;
  is_canceled:boolean;has_refunds:boolean
}
export type EtsyItem = {
  shop_id:number;receipt_id:number;transaction_id:number;
  quantity:number;match_state:string;design_id:string|null;title:string
}
export type ProductionJob = {
  shop_id:number;receipt_id:number;transaction_id:number;status:string;design_id:string
}
export type EtsySnapshot = {
  shopId:number;receipts:EtsyReceipt[];items:EtsyItem[];jobs:ProductionJob[]
}
export type Material = {
  sku:string;name:string;unit:string;on_hand:number;unit_cost_cents:number|null;
  supplier_name:string|null;supplier_url:string|null
}
export type MaterialPlan = {
  shop_id:number;receipt_id:number;transaction_id:number;status:string
}
export type MaterialLine = {
  shop_id:number;receipt_id:number;transaction_id:number;sku:string;quantity_required:number
}
export type Purchase = {
  purchase_id:string;sku:string;status:string;quantity_ordered:number;
  quantity_received:number;supplier_reference:string;unit_cost_cents_snapshot:number|null
}
export type MaterialSnapshot = {
  shopId:number;parts:Material[];plans:MaterialPlan[];lines:MaterialLine[];
  purchases:Purchase[]
}
export type Mapping = {
  sku:string;asin:string;pack_quantity:number;enabled:boolean
}
export type ProcurementSnapshot = {mappings:Mapping[]}
export type ManualPart = {
  sku:string;name:string;unit:string;required:number;onHand:number;pending:number;
  shortage:number;additionalNeeded:number;estimatedPacks:number|null;
  asin:string|null;url:string;lookup:'mapped_asin'|'amazon_search';
  unitCostCents:number|null;warnings:string[]
}
export type JobNotice = {shopId:number;receiptId:number;transactionId:number;reason:string}
export type ManualBuyingQueue = {
  paidReceipts:number;eligibleJobs:number;unplanned:JobNotice[];review:JobNotice[];
  parts:ManualPart[];complete:boolean;warnings:string[];realCheckoutEnabled:false
}
const key=(x:{shop_id:number;receipt_id:number;transaction_id:number})=>
  [x.shop_id,x.receipt_id,x.transaction_id].join(':')
const receiptKey=(x:{shop_id:number;receipt_id:number})=>[x.shop_id,x.receipt_id].join(':')
const good=(r:EtsyReceipt)=>r.is_paid&&!r.is_canceled&&!r.has_refunds&&
  ['paid','completed'].includes(r.etsy_status)
const active=(job:ProductionJob)=>job.status==='awaiting_review'||job.status==='in_progress'
const round=(v:number)=>Math.round(v*1000)/1000
const validNumber=(n:number)=>Number.isFinite(n)&&n>=0
const isAsin=(v:string)=>/^[A-Z0-9]{10}$/.test(v)
export function amazonProductUrl(asin:string):string|null{
  return isAsin(asin)?'https://www.amazon.com/dp/'+asin:null
}
export function amazonSearchUrl(name:string):string{
  // Browsing products is not purchasing; search results must be manually verified.
  return 'https://www.amazon.com/s?k='+encodeURIComponent(name.slice(0,120))
}
export function buildManualBuyingQueue(
  etsy:EtsySnapshot,m3:MaterialSnapshot,m6:ProcurementSnapshot
):ManualBuyingQueue{
  const receipts=etsy.receipts.filter(good)
  const paid=new Set(receipts.map(receiptKey))
  const hasFullData=etsy.receipts.length<100&&etsy.items.length<300&&etsy.jobs.length<300&&
    m3.parts.length<300&&m3.plans.length<300&&m3.lines.length<1000&&
    m3.purchases.length<300&&m6.mappings.length<300&&etsy.shopId===m3.shopId
  const notices:JobNotice[]=[]
  const unplanned:JobNotice[]=[]
  const needed=new Map<string,number>()
  let eligibleJobs=0
  const byJob=new Map(etsy.jobs.map(x=>[key(x),x]))
  const plans=new Map(m3.plans.map(x=>[key(x),x]))
  const bySku=new Map(m3.parts.map(x=>[x.sku,x]))
  const mappings=new Map(m6.mappings.filter(x=>x.enabled&&isAsin(x.asin)&&
    validNumber(x.pack_quantity)&&x.pack_quantity>0).map(x=>[x.sku,x]))
  for(const item of etsy.items){
    if(!paid.has(receiptKey(item)))continue
    const notice={shopId:item.shop_id,receiptId:item.receipt_id,
      transactionId:item.transaction_id,reason:''}
    const job=byJob.get(key(item))
    if(item.match_state!=='matched'||item.quantity!==1||!item.design_id||
      !job||job.design_id!==item.design_id){
      notices.push({...notice,reason:'Design match or single-item production job requires review'})
      continue
    }
    if(!active(job))continue
    eligibleJobs++
    const plan=plans.get(key(item))
    if(!plan||!['draft','reviewed'].includes(plan.status)){
      unplanned.push({...notice,reason:'Create and confirm a frame BOM before buying parts'})
      continue
    }
    const lines=m3.lines.filter(x=>key(x)===key(item))
    if(!lines.length||lines.some(x=>!bySku.has(x.sku)||
       !validNumber(x.quantity_required)||x.quantity_required<=0)){
      unplanned.push({...notice,reason:'Job BOM missing or has invalid material lines'})
      continue
    }
    for(const line of lines)needed.set(line.sku,
      (needed.get(line.sku)||0)+line.quantity_required)
  }
  const warnings:string[]=[]
  if(!hasFullData)warnings.push(
    'A source list reached its pagination limit or shop IDs disagree; do not rely on quantities')
  if(etsy.receipts.length===0)warnings.push(
    'No imported Etsy receipts. Use Sync Etsy now; the queue cannot detect unimported orders.')
  if(unplanned.length)warnings.push(
    'At least one verified paid job lacks a complete BOM; quantities are incomplete.')
  if(notices.length)warnings.push(
    'Some paid Etsy items require design/payment review and were not included in buying quantities.')
  const parts:ManualPart[]=[]
  for(const [sku,requiredRaw] of needed){
    const part=bySku.get(sku)
    if(!part)continue
    const required=round(requiredRaw)
    const stock=Number(part.on_hand)
    const pending=m3.purchases.filter(p=>p.sku===sku&&
      ['ordered','partially_received'].includes(p.status)).reduce((sum,p)=>
      sum+Math.max(0,Number(p.quantity_ordered)-Number(p.quantity_received)),0)
    const shortage=Math.max(0,round(required-stock))
    const additionalNeeded=Math.max(0,round(shortage-pending))
    if(shortage<=0)continue
    const mapping=mappings.get(sku)
    const product=mapping?amazonProductUrl(mapping.asin):null
    const pack=mapping?.pack_quantity
    const lineWarnings:string[]=[]
    if(!product)lineWarnings.push('Amazon product not verified — search and confirm specifications')
    if(!pack)lineWarnings.push('Supplier pack size not verified')
    if(part.unit_cost_cents===null)lineWarnings.push('Actual landed unit cost not entered')
    if(additionalNeeded===0)lineWarnings.push('Already covered by recorded incoming supplier orders')
    parts.push({sku,name:part.name,unit:part.unit,required,onHand:stock,
      pending:round(pending),shortage,additionalNeeded,
      estimatedPacks:pack&&additionalNeeded>0?Math.ceil(additionalNeeded/pack):null,
      asin:product?mapping!.asin:null,url:product||amazonSearchUrl(part.name),
      lookup:product?'mapped_asin':'amazon_search',
      unitCostCents:part.unit_cost_cents,warnings:lineWarnings})
  }
  parts.sort((a,b)=>a.sku.localeCompare(b.sku))
  return {paidReceipts:receipts.length,eligibleJobs,unplanned,review:notices,
    parts,complete:hasFullData&&unplanned.length===0&&notices.length===0,
    warnings,realCheckoutEnabled:false}
}
