import type { MaterialSnapshot } from './manualAmazonQueue'

export type JobPartRow={
  sku:string;name:string;required:number;unit:string
  physicalOnHand:number;pendingFromSuppliers:number
  supplierUrl:string|null
}
export type JobPartsSummary={
  prepared:boolean;planStatus:string|null;rows:JobPartRow[]
  note:string
}
export function materialsForProductionJob(
  materials:MaterialSnapshot|null,
  shopId:number,receiptId:number,transactionId:number,
):JobPartsSummary{
  if(!materials)return {prepared:false,planStatus:null,rows:[],
    note:'Materials are loading or unavailable. Check the M3 materials section.'}
  if(materials.shopId!==shopId)return {prepared:false,planStatus:null,rows:[],
    note:'Shop does not match the inventory record; do not purchase.'}
  const plan=materials.plans.find(x=>x.shop_id===shopId&&
    x.receipt_id===receiptId&&x.transaction_id===transactionId)
  if(!plan)return {prepared:false,planStatus:null,rows:[],
    note:'No production bill of materials is prepared for this paid job.'}
  if(!['draft','reviewed'].includes(plan.status))return {
    prepared:false,planStatus:plan.status,rows:[],
    note:'The bill of materials is on hold. Review it before buying parts.'}
  const lines=materials.lines.filter(x=>x.shop_id===shopId&&
    x.receipt_id===receiptId&&x.transaction_id===transactionId)
  if(!lines.length)return {prepared:false,planStatus:plan.status,rows:[],
    note:'Bill of materials has no components. Review the frame recipe.'}
  const rows=lines.map(line=>{
    const part=materials.parts.find(x=>x.sku===line.sku)
    const incoming=materials.purchases.filter(p=>p.sku===line.sku &&
      ['ordered','partially_received'].includes(p.status)).reduce(
      (sum,p)=>sum+Math.max(0,Number(p.quantity_ordered)-Number(p.quantity_received)),0)
    return {
      sku:line.sku,name:part?.name??line.sku,
      required:Number(line.quantity_required),unit:part?.unit??'units',
      physicalOnHand:part?Number(part.on_hand):0,
      pendingFromSuppliers:incoming,
      supplierUrl:part?.supplier_url??null,
    }
  })
  if(rows.some(x=>!Number.isFinite(x.required)||x.required<=0||
    x.unit==='units'))return {prepared:false,planStatus:plan.status,rows:[],
    note:'One or more BOM components are missing or invalid in inventory.'}
  return {prepared:true,planStatus:plan.status,rows,
    note:'Stock shown is shared across all jobs. Use the combined Amazon shopping checklist to calculate what to buy.'}
}
