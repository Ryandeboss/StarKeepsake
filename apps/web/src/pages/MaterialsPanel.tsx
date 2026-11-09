import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './MaterialsPanel.css'

type Material = {sku:string;name:string;category:string;unit:string;unit_cost_cents:number|null;on_hand:number;reorder_at:number;supplier_name:string|null;supplier_url:string|null;notes:string|null}
type Recipe = {recipe_code:string;name:string;finish:string}
type RecipeLine = {recipe_code:string;sku:string;quantity_per_frame:number;waste_percent:number}
type Plan = {shop_id:number;receipt_id:number;transaction_id:number;recipe_code:string;finish:string;status:string}
type PlanLine = {shop_id:number;receipt_id:number;transaction_id:number;sku:string;name_snapshot:string;unit_snapshot:string;quantity_required:number;unit_cost_cents_snapshot:number|null}
type Job = {shop_id:number;receipt_id:number;transaction_id:number;design_id:string;status:string}
type MaterialsData = {shopId:number;parts:Material[];recipes:Recipe[];recipeLines:RecipeLine[];plans:Plan[];lines:PlanLine[];jobs:Job[]}
type MaterialForm = {sku:string;name:string;category:string;unit:string;price:string;reorder:string;supplier:string;url:string;notes:string}
const EMPTY:MaterialForm={sku:'',name:'',category:'other',unit:'each',price:'',reorder:'0',supplier:'',url:'',notes:''}
const BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
const price=(v:number|null)=>v===null?'Unpriced':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100)
const qty=(v:number)=>Number(v).toLocaleString('en-US',{maximumFractionDigits:3})
function cents(value:string):number|null{
  if(!value.trim())return null
  if(!/^\d{1,7}(\.\d{1,2})?$/.test(value))throw new Error('Enter USD price with at most two decimal places.')
  return Math.round(Number(value)*100)
}
async function request<T>(path:string,adminKey:string,method='GET',body?:unknown):Promise<T>{
  const result=await fetch(BASE+path,{method,cache:'no-store',headers:{
    'X-Starkeepsake-Admin-Key':adminKey,
    ...(body===undefined?{}:{'Content-Type':'application/json'})
  },body:body===undefined?undefined:JSON.stringify(body)})
  if(!result.ok){
    if(result.status===401)throw new Error('Admin authorization failed. Lock the studio and sign in again.')
    throw new Error(result.status===409?'Request rejected. Check SKU, quantities, recipe and paid-job eligibility.':
      'Materials service returned HTTP '+result.status)
  }
  return result.json() as Promise<T>
}
export function MaterialsPanel({adminKey}:{adminKey:string}){
  const [data,setData]=useState<MaterialsData|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [item,setItem]=useState<MaterialForm>(EMPTY)
  const [stockSku,setStockSku]=useState('')
  const [stockDelta,setStockDelta]=useState('')
  const [stockReason,setStockReason]=useState('')
  const [recipeCode,setRecipeCode]=useState('');const [recipeName,setRecipeName]=useState('')
  const [recipeFinish,setRecipeFinish]=useState('walnut')
  const [lines,setLines]=useState<{sku:string;quantity:string;waste:string}[]>([{sku:'',quantity:'1',waste:'0'}])
  const [jobKey,setJobKey]=useState('');const [jobRecipe,setJobRecipe]=useState('')
  const reload=async()=>setData(await request<MaterialsData>('/api/admin/materials',adminKey))
  useEffect(()=>{let live=true
    void request<MaterialsData>('/api/admin/materials',adminKey).then(v=>{if(live)setData(v)})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load materials.')})
    return()=>{live=false}
  },[adminKey])
  async function act(label:string,task:()=>Promise<unknown>){
    setBusy(true);setError('');setSuccess('')
    try{await task();await reload();setSuccess(label)}
    catch(e){setError(e instanceof Error?e.message:'Request failed.')}
    finally{setBusy(false)}
  }
  async function saveMaterial(event:FormEvent){
    event.preventDefault()
    await act('Material saved. Enter a physical stock adjustment separately.',()=>{
      const cost=cents(item.price)
      return request('/api/admin/materials/catalog',adminKey,'POST',{
        sku:item.sku.trim().toUpperCase(),name:item.name.trim(),category:item.category,
        unit:item.unit,unitCostCents:cost,reorderAt:Number(item.reorder),
        supplierName:item.supplier.trim()||null,supplierUrl:item.url.trim()||null,notes:item.notes.trim()||null
      })
    })
  }
  async function adjust(event:FormEvent){
    event.preventDefault()
    if(!stockSku||!stockDelta||!stockReason.trim())return
    // A retry of the same request should use the same UUID; do not auto-retry on failure.
    const movementId=crypto.randomUUID()
    await act('Inventory count adjusted. No purchase or stock reservation was made.',()=>
      request('/api/admin/materials/stock',adminKey,'POST',{
        sku:stockSku,delta:Number(stockDelta),reason:stockReason.trim(),movementId
      }))
    setStockDelta('');setStockReason('')
  }
  async function saveRecipe(event:FormEvent){
    event.preventDefault()
    await act('Recipe saved. Previously prepared job snapshots were not changed.',()=>
      request('/api/admin/materials/recipes',adminKey,'POST',{
        recipeCode:recipeCode.trim().toLowerCase(),name:recipeName.trim(),finish:recipeFinish,
        lines:lines.map(l=>({sku:l.sku,quantityPerFrame:Number(l.quantity),wastePercent:Number(l.waste)}))
      }))
  }
  async function prepare(event:FormEvent){
    event.preventDefault()
    if(!jobKey||!jobRecipe)return
    const [shopId,receiptId,transactionId]=jobKey.split(':').map(Number)
    await act('Draft BOM saved for manual review. Inventory was not deducted.',()=>
      request('/api/admin/materials/plan',adminKey,'POST',{shopId,receiptId,transactionId,recipeCode:jobRecipe}))
  }
  const pendingJobs=data?.jobs.filter(j=>j.status==='awaiting_review' &&
    !data.plans.some(p=>p.shop_id===j.shop_id&&p.receipt_id===j.receipt_id&&p.transaction_id===j.transaction_id))??[]
  const shortages=useMemo(()=>{
    if(!data)return []
    return data.parts.map(part=>{
      const needed=data.lines.filter(l=>l.sku===part.sku &&
        data.plans.some(p=>p.shop_id===l.shop_id&&p.receipt_id===l.receipt_id&&p.transaction_id===l.transaction_id &&
          data.jobs.some(j=>j.shop_id===p.shop_id&&j.receipt_id===p.receipt_id&&j.transaction_id===p.transaction_id&&j.status!=='hold'&&j.status!=='complete')))
        .reduce((sum,l)=>sum+Number(l.quantity_required),0)
      const short=Math.max(0,Math.ceil((needed-Number(part.on_hand))*1000)/1000)
      return {part,needed,short}
    }).filter(x=>x.short>0)
  },[data])
  const plans=data?.plans??[]
  return <section className="materials-section" id="materials-planning">
    <div className="materials-heading"><div>
      <p className="production-eyebrow">M3 / WORKSHOP OPERATIONS</p>
      <h2>Materials & costing</h2>
      <p>Manage actual inventory, build recipes and prepare per-order parts estimates. No supplier checkout or stock deduction.</p>
    </div><button type="button" disabled={busy} onClick={()=>void act('Inventory refreshed.',reload)}>Refresh materials</button></div>
    {error&&<p role="alert" className="materials-error">{error}</p>}
    {success&&<p role="status" className="materials-success">{success}</p>}
    <div className="materials-metrics"><article><small>Catalog items</small><strong>{data?.parts.length??'—'}</strong></article>
      <article><small>Saved recipes</small><strong>{data?.recipes.length??'—'}</strong></article>
      <article><small>Draft job BOMs</small><strong>{plans.length}</strong></article>
      <article><small>Items short for planned jobs</small><strong>{shortages.length}</strong></article></div>
    <div className="materials-grid">
      <form onSubmit={e=>void saveMaterial(e)} className="materials-form">
        <h3>Add / update catalog item</h3>
        <p>Use real prices and supplier links; leave price blank when unknown. SKU and unit cannot change after creation.</p>
        <label>SKU <input required maxLength={40} value={item.sku} placeholder="WOOD-WALNUT"
          onChange={e=>setItem({...item,sku:e.target.value.toUpperCase()})}/></label>
        <label>Material name <input required value={item.name} maxLength={120} placeholder="Walnut frame rail"
          onChange={e=>setItem({...item,name:e.target.value})}/></label>
        <div className="materials-two"><label>Category <select value={item.category} onChange={e=>setItem({...item,category:e.target.value})}>
          {['frame','photo','lighting','electronics','mounting','packaging','consumable','other'].map(x=><option key={x}>{x}</option>)}
        </select></label><label>Unit <select value={item.unit} onChange={e=>setItem({...item,unit:e.target.value})}>
          {['each','ft','m','sheet','ml'].map(x=><option key={x}>{x}</option>)}</select></label></div>
        <div className="materials-two"><label>Unit price (USD) <input value={item.price} inputMode="decimal"
          placeholder="Unknown" onChange={e=>setItem({...item,price:e.target.value})}/></label>
          <label>Reorder at <input type="number" step=".001" min="0" required value={item.reorder}
            onChange={e=>setItem({...item,reorder:e.target.value})}/></label></div>
        <label>Supplier <input maxLength={120} value={item.supplier} placeholder="Optional"
          onChange={e=>setItem({...item,supplier:e.target.value})}/></label>
        <label>Supplier link <input type="url" value={item.url} placeholder="https://…"
          onChange={e=>setItem({...item,url:e.target.value})}/></label>
        <button className="production-primary" type="submit" disabled={busy}>Save material</button>
      </form>
      <form onSubmit={e=>void adjust(e)} className="materials-form">
        <h3>Physical inventory adjustment</h3>
        <p>Enter the actual amount received or consumed. Use a minus sign for stock used or discarded. Never records a purchase.</p>
        <label>Material <select required value={stockSku} onChange={e=>setStockSku(e.target.value)}>
          <option value="">Choose material</option>{data?.parts.map(p=><option key={p.sku} value={p.sku}>{p.sku} — {p.name}</option>)}</select></label>
        <label>Quantity change <input type="number" step=".001" required value={stockDelta} placeholder="+5 or -2"
          onChange={e=>setStockDelta(e.target.value)}/></label>
        <label>Reason <input required minLength={3} maxLength={200} value={stockReason}
          placeholder="Physical count / used for prototype" onChange={e=>setStockReason(e.target.value)}/></label>
        <button className="production-primary" type="submit" disabled={busy||!data?.parts.length}>Record stock adjustment</button>
      </form>
      <form onSubmit={e=>void saveRecipe(e)} className="materials-form materials-wide">
        <h3>Frame bill-of-materials recipe</h3>
        <p>Recipes apply to future draft plans; once a job plan is created its quantities and prices are frozen.</p>
        <div className="materials-two"><label>Recipe code <input required minLength={3} value={recipeCode} placeholder="walnut-standard"
          onChange={e=>setRecipeCode(e.target.value.toLowerCase())}/></label>
          <label>Recipe label <input required minLength={3} value={recipeName} placeholder="Walnut star photo frame"
            onChange={e=>setRecipeName(e.target.value)}/></label></div>
        <label>Applicable frame finish <select value={recipeFinish} onChange={e=>setRecipeFinish(e.target.value)}>
          {['walnut','oak','ebony','any'].map(x=><option key={x}>{x}</option>)}</select></label>
        {lines.map((line,i)=><div className="materials-recipe-line" key={i}>
          <label>Part <select required value={line.sku} onChange={e=>setLines(xs=>xs.map((x,j)=>j===i?{...x,sku:e.target.value}:x))}>
            <option value="">Select SKU</option>{data?.parts.map(x=><option key={x.sku} value={x.sku}>{x.sku}</option>)}</select></label>
          <label>Qty / frame <input type="number" required min=".001" max="10000" step=".001" value={line.quantity}
            onChange={e=>setLines(xs=>xs.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))}/></label>
          <label>Waste % <input type="number" required min="0" max="100" step=".01" value={line.waste}
            onChange={e=>setLines(xs=>xs.map((x,j)=>j===i?{...x,waste:e.target.value}:x))}/></label>
          <button type="button" disabled={lines.length===1} onClick={()=>setLines(xs=>xs.filter((_,j)=>j!==i))}>Remove</button>
        </div>)}
        <div className="materials-actions"><button type="button" onClick={()=>setLines(xs=>[...xs,{sku:'',quantity:'1',waste:'0'}])}
          disabled={lines.length>=60}>Add recipe part</button>
          <button className="production-primary" type="submit" disabled={busy||!data?.parts.length}>Save recipe</button></div>
      </form>
    </div>
    <h3>Catalog and stock on hand</h3>
    <div className="materials-table-scroll"><table><thead><tr><th>SKU / DESCRIPTION</th><th>AVAILABLE</th>
      <th>UNIT COST</th><th>REORDER</th><th>SUPPLIER</th></tr></thead><tbody>
      {data?.parts.map(p=><tr key={p.sku}><td><strong>{p.sku}</strong><small>{p.name} · {p.category}</small></td>
        <td>{qty(Number(p.on_hand))} {p.unit}</td><td>{price(p.unit_cost_cents)}</td><td>{qty(Number(p.reorder_at))}</td>
        <td>{p.supplier_url?<a href={p.supplier_url} target="_blank" rel="noopener noreferrer">{p.supplier_name||'Supplier site'}</a>:p.supplier_name||'—'}</td></tr>)}
      </tbody></table>{!data?.parts.length&&<p className="materials-empty">No real materials have been entered yet. Add your first SKU above.</p>}</div>
    <h3>Purchase planning <small>(no checkout)</small></h3>
    <p className="materials-explain">Shortfalls aggregate draft plans for active Etsy jobs. Counts are estimates, not reservations; physical stock is updated only by a manual adjustment.</p>
    <div className="materials-table-scroll"><table><thead><tr><th>SKU</th><th>NEEDED FOR PLANS</th>
      <th>ON HAND</th><th>SHORT BY</th><th>EST. ADDITIONAL PARTS COST</th></tr></thead><tbody>
      {shortages.map(({part,needed,short})=><tr key={part.sku}><td>{part.sku}</td><td>{qty(needed)} {part.unit}</td>
        <td>{qty(Number(part.on_hand))}</td><td>{qty(short)}</td>
        <td>{part.unit_cost_cents===null?'Unpriced':price(Math.round(short*part.unit_cost_cents))}</td></tr>)}
      </tbody></table>{!shortages.length&&<p className="materials-empty">No shortages calculated. Create a real job BOM to see aggregate needs.</p>}</div>
    <div className="materials-grid">
      <form onSubmit={e=>void prepare(e)} className="materials-form">
        <h3>Prepare parts for a verified Etsy job</h3>
        <p>Only paid, single-quantity, saved-design matches can produce draft BOMs. Choose the matching wood finish recipe.</p>
        <label>Etsy production job <select required value={jobKey} onChange={e=>setJobKey(e.target.value)}>
          <option value="">Choose unmatched job</option>
          {pendingJobs.map(j=><option key={j.transaction_id} value={[j.shop_id,j.receipt_id,j.transaction_id].join(':')}>
            Order #{j.receipt_id} · {j.design_id}</option>)}
        </select></label>
        <label>Recipe <select required value={jobRecipe} onChange={e=>setJobRecipe(e.target.value)}>
          <option value="">Choose recipe</option>{data?.recipes.map(r=><option key={r.recipe_code} value={r.recipe_code}>
            {r.name} ({r.finish})</option>)}</select></label>
        <button className="production-primary" type="submit" disabled={busy||!pendingJobs.length||!data?.recipes.length}>Prepare draft BOM</button>
      </form>
      <div className="materials-form">
        <h3>Job cost snapshots</h3>
        {!plans.length?<p>No real paid and verified Etsy jobs have a prepared BOM yet.</p>:plans.map(p=>{
          const linesForJob=data?.lines.filter(l=>l.shop_id===p.shop_id&&l.receipt_id===p.receipt_id&&l.transaction_id===p.transaction_id)??[]
          const missing=linesForJob.some(l=>l.unit_cost_cents_snapshot===null)
          const total=linesForJob.reduce((acc,l)=>acc+Math.round(l.quantity_required*(l.unit_cost_cents_snapshot??0)),0)
          return <div className="materials-snapshot" key={p.transaction_id}>
            <strong>Order #{p.receipt_id} · {p.finish}</strong>
            <small>Recipe {p.recipe_code} · {p.status} · {linesForJob.length} parts</small>
            <span>Material estimate: {missing?'Incomplete — at least one unpriced part':price(total)}</span>
          </div>
        })}
      </div>
    </div>
    <p className="materials-footnote">Estimates exclude taxes, shipping, labor, tooling and waste not defined in the recipe. No Etsy, supplier or Amazon purchase is placed; inventory is never decremented by merely preparing a BOM.</p>
  </section>
}
