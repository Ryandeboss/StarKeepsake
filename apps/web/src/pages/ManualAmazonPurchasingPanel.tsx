import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {buildManualBuyingQueue,type ManualBuyingQueue,type EtsySnapshot,
  type MaterialSnapshot,type ProcurementSnapshot, type Purchase} from '../manualAmazonQueue'
import './ManualAmazonPurchasingPanel.css'

const BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
const money=(c:number|null)=>c===null?'Unpriced':
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100)
const qty=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:3})
async function request<T>(key:string,path:string,method='GET',body?:unknown):Promise<T>{
  const resp=await fetch(BASE+path,{method,cache:'no-store',
    headers:{'X-Starkeepsake-Admin-Key':key,
      ...(body===undefined?{}:{'Content-Type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body)})
  if(!resp.ok){
    if(resp.status===401)throw new Error('Owner authorization expired. Lock and reopen the Studio.')
    if(resp.status===429)throw new Error('Too many requests. Try again shortly.')
    if(resp.status===409)throw new Error('Supplier order record rejected. Confirm the reference and quantity.')
    throw new Error('Unable to load or log manual purchases (HTTP '+resp.status+').')
  }
  return resp.json() as Promise<T>
}
type Snapshot={queue:ManualBuyingQueue;raw:MaterialSnapshot}
const cents=(value:string):number|null=>{
  if(!value.trim())return null
  if(!/^\d{1,7}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a unit price in USD with no more than two decimals.')
  const v=Math.round(Number(value)*100)
  if(!Number.isSafeInteger(v)||v<0||v>100000000)throw new Error('Invalid unit price.')
  return v
}
export function ManualAmazonPurchasingPanel({adminKey,refreshVersion}:{adminKey:string;refreshVersion:number}){
  const [state,setState]=useState<Snapshot|null>(null)
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [sku,setSku]=useState('')
  const [quantity,setQuantity]=useState('')
  const [orderReference,setOrderReference]=useState('')
  const [unitCost,setUnitCost]=useState('')
  const [confirmPlaced,setConfirmPlaced]=useState(false)
  const retry=useRef<{signature:string;id:string}|null>(null)
  const load=useCallback(async():Promise<Snapshot>=>{
    const [etsy,m3,m6]=await Promise.all([
      request<EtsySnapshot>(adminKey,'/api/admin/production/orders'),
      request<MaterialSnapshot>(adminKey,'/api/admin/materials'),
      request<ProcurementSnapshot>(adminKey,'/api/admin/procurement/preview')
    ])
    const result={queue:buildManualBuyingQueue(etsy,m3,m6),raw:m3}
    setState(result)
    return result
  },[adminKey])
  const reload=useCallback(async()=>{
    setLoading(true);setError('')
    try{await load()}
    catch(e){setError(e instanceof Error?e.message:'Manual queue could not load.')}
    finally{setLoading(false)}
  },[load])
  useEffect(()=>{
    let active=true
    // Only poll while the owner Studio is open. No Etsy sync or purchase happens here.
    const refresh=()=>void load().catch(e=>{if(active)setError(
      e instanceof Error?e.message:'Manual queue unavailable.')})
    refresh()
    const timer=window.setInterval(refresh,120000)
    return()=>{active=false;window.clearInterval(timer)}
  },[load,refreshVersion])
  const queue=state?.queue
  const pending=queue?.parts.filter(x=>x.additionalNeeded>0)??[]
  const missing=queue?.unplanned.length??0
  const otherReview=queue?.review.length??0
  const selects=pending
  function choose(id:string,amount:number){
    setSku(id);setQuantity(String(amount));setOrderReference('');setUnitCost('')
    setConfirmPlaced(false);setError('');setNotice('')
    document.getElementById('manual-amazon-record')?.scrollIntoView({behavior:'smooth',block:'start'})
  }
  async function logPurchase(event:FormEvent){
    event.preventDefault()
    setError('');setNotice('')
    if(!state||!sku||!confirmPlaced)return
    const amount=Number(quantity)
    if(!Number.isFinite(amount)||amount<=0||amount>100000||
      Math.round(amount*1000)!==amount*1000){
      setError('Enter a positive purchased quantity of usable units (up to three decimals).')
      return
    }
    const reference=orderReference.trim()
    if(reference.length<3||reference.length>120){
      setError('Enter the actual Amazon order reference (3–120 characters).')
      return
    }
    let actualCost:number|null
    try{actualCost=cents(unitCost)}
    catch(e){setError(e instanceof Error?e.message:'Invalid unit price.');return}
    const signature=JSON.stringify([sku,amount,reference,actualCost])
    const purchaseId=retry.current?.signature===signature?
      retry.current.id:crypto.randomUUID()
    retry.current={signature,id:purchaseId}
    setSaving(true)
    try{
      // Re-check the latest database state before recording a manually placed order.
      // The existing M3 server RPC also enforces stable purchase IDs and positive quantities.
      const fresh=await load()
      const duplicate=(fresh.raw.purchases as Purchase[]).some(p=>p.sku===sku&&
        p.supplier_reference.trim().toUpperCase()===reference.toUpperCase())
      if(duplicate)throw new Error(
        'This Amazon order reference was already recorded for this SKU. No duplicate created.')
      if(!fresh.raw.parts.some(p=>p.sku===sku))
        throw new Error('SKU no longer exists in the M3 inventory catalog.')
      await request(adminKey,'/api/admin/materials/purchases','POST',{
        purchaseId,sku,quantity:amount,supplierReference:reference,unitCostCents:actualCost
      })
      retry.current=null
      setSku('');setQuantity('');setOrderReference('');setUnitCost('')
      setConfirmPlaced(false)
      setNotice('Purchase recorded as ON ORDER, not received. Record physical delivery in M3 when it arrives.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'Could not log supplier purchase.')}
    finally{setSaving(false)}
  }
  return <section className="materials-section manual-amazon" id="manual-amazon-purchasing" aria-label="Manual Amazon purchasing">
    <div className="materials-heading">
      <div><p className="production-eyebrow">MANUAL SOURCING / WHILE AMAZON API ACCESS IS PENDING</p>
        <h2>Amazon shopping checklist</h2>
        <p>Paid Etsy orders create a purchasing review. You open Amazon, choose products,
          pay yourself, and record the Amazon order reference here. No automatic checkout.</p></div>
      <button type="button" onClick={()=>void reload()} disabled={loading||saving}>
        {loading?'Checking…':'Refresh purchase checklist'}</button>
    </div>
    <p className="manual-amazon-safe" role="status">MANUAL ONLY · AMAZON LINKS DO NOT PURCHASE · VERIFIED PAID JOBS ONLY</p>
    {error&&<p className="materials-error" role="alert">{error}</p>}
    {notice&&<p className="materials-success" role="status">{notice}</p>}
    <div className="materials-metrics">
      <article><small>Imported paid receipts</small><strong>{queue?.paidReceipts??'—'}</strong></article>
      <article><small>Paid production jobs</small><strong>{queue?.eligibleJobs??'—'}</strong></article>
      <article><small>BOMs to prepare</small><strong>{queue?.unplanned.length??'—'}</strong></article>
      <article><small>Parts to source</small><strong>{pending.length}</strong></article>
    </div>
    {queue?.warnings.map((w,i)=><p key={i} className="manual-amazon-note">{w}</p>)}
    {!!missing&&<div className="manual-amazon-attention">
      <h3>Action needed: confirm the bill of materials first</h3>
      <p>{missing} verified paid job{missing===1?'':'s'} cannot have a reliable shopping list until the frame recipe is confirmed.
        Use the M3 Materials section below to create the matching recipe and prepare its job BOM.</p>
      <ul>{queue?.unplanned.map(j=><li key={j.shopId+':'+j.receiptId+':'+j.transactionId}>
        Etsy #{j.receiptId}, item #{j.transactionId} — {j.reason}</li>)}</ul>
      <a href="#materials-planning">Go to M3 recipes and job BOMs</a>
    </div>}
    {!!otherReview&&<div className="manual-amazon-attention">
      <h3>Orders requiring review — do not source blindly</h3>
      <ul>{queue?.review.map(j=><li key={j.shopId+':'+j.receiptId+':'+j.transactionId}>
        Etsy #{j.receiptId}, item #{j.transactionId} — {j.reason}</li>)}</ul>
    </div>}
    {queue?.complete===false&&<p className="manual-amazon-note">
      Buying quantities may be incomplete until the warnings above are cleared. Verify the full Etsy order and frame configuration before placing any supplier purchase.</p>}
    <h3>Components to buy or verify</h3>
    <p className="materials-explain">Quantities exclude stock already on hand and existing pending supplier orders.
      An ASIN mapping or search result is not proof that the exact product, price, packaging, or availability is correct.</p>
    <div className="materials-table-scroll"><table><thead><tr>
      <th>PART</th><th>REQUIRED</th><th>ON HAND</th><th>ON ORDER</th><th>BUY MORE</th><th>AMAZON</th><th>ACTION</th>
    </tr></thead><tbody>
      {queue?.parts.map(p=><tr key={p.sku}>
        <td><strong>{p.sku}</strong><small>{p.name}</small></td>
        <td>{qty(p.required)} {p.unit}</td><td>{qty(p.onHand)}</td>
        <td>{qty(p.pending)}</td><td><strong>{qty(p.additionalNeeded)} {p.unit}</strong>
          {p.estimatedPacks!==null&&p.additionalNeeded>0&&
            <small>Approx. {qty(p.estimatedPacks)} mapped packs; verify listing</small>}</td>
        <td><a href={p.url} target="_blank" rel="noopener noreferrer">
          {p.lookup==='mapped_asin'?'Open mapped Amazon ASIN':'Search Amazon products'}</a>
          {p.warnings.map(x=><small key={x}>{x}</small>)}</td>
        <td>{p.additionalNeeded>0&&<button type="button" onClick={()=>choose(p.sku,p.additionalNeeded)}
          disabled={!queue.complete}>Record after buying</button>}</td>
      </tr>)}</tbody></table>
      {!queue?.parts.length&&<p className="materials-empty">
        No known shortages yet. This does not mean all parts are ready: check paid jobs and missing BOMs above.
      </p>}
    </div>
    <form className="materials-form manual-amazon-log" id="manual-amazon-record" onSubmit={e=>void logPurchase(e)}>
      <h3>Record an Amazon order you already placed</h3>
      <p>Only submit this after Amazon has confirmed the purchase. Enter the quantity of usable individual
        components, <strong>not</strong> the number of packs unless the M3 unit is itself a pack.</p>
      <div className="materials-two">
        <label>Material SKU <select required value={sku} onChange={e=>{
          const next=selects.find(x=>x.sku===e.target.value);setSku(e.target.value)
          setQuantity(next?String(next.additionalNeeded):'');setConfirmPlaced(false)}}>
          <option value="">Select a shortage</option>
          {selects.map(p=><option key={p.sku} value={p.sku}>{p.sku} · {p.name}</option>)}</select></label>
        <label>Actual ordered quantity (M3 units) <input type="number" min=".001" max="100000"
          step=".001" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
      </div>
      <div className="materials-two">
        <label>Amazon order reference <input required minLength={3} maxLength={120}
          value={orderReference} placeholder="Your actual Amazon confirmation ID"
          onChange={e=>setOrderReference(e.target.value)}/></label>
        <label>Actual price per usable unit (USD, optional)
          <input value={unitCost} inputMode="decimal" placeholder="Leave unknown if unsure"
            onChange={e=>setUnitCost(e.target.value)}/></label>
      </div>
      <label className="manual-amazon-confirm">
        <input type="checkbox" checked={confirmPlaced}
          onChange={e=>setConfirmPlaced(e.target.checked)}/>
        I personally completed this purchase on Amazon and verified the actual product, quantity, and order reference.
      </label>
      <button type="submit" className="production-primary"
        disabled={!confirmPlaced||!sku||saving||loading||!queue?.complete}>
        {saving?'Recording…':'Record placed Amazon order (does not buy)'}
      </button>
    </form>
    <p className="materials-footnote">New Etsy orders appear here after the existing Etsy webhook or
      Sync Etsy now import confirms payment. The queue refreshes every two minutes while the
      owner Studio remains open. No email, SMS, or background device notification is configured.
      Once a shipment arrives, record receiving separately in the M3 Materials section.</p>
  </section>
}
