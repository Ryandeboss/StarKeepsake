import { useEffect,useState,type FormEvent } from 'react'
import './ProcurementPanel.css'

type Need={sku:string;name:string;unit:string;required:number;onHand:number;
  onOrder:number;netToOrder:number;asin:string|null;packsToBuy:number|null;
  estimatedPurchaseCents:number|null;blocks:string[]}
type Preview={mode:string;checkoutEnabled:boolean;offersVerified:boolean;
  activePaidJobs:number;snapshotComplete:boolean;estimatedMaterialsCents:number|null;lines:Need[]}
type Mapping={sku:string;asin:string;pack_quantity:number;enabled:boolean}
type Response={preview:Preview;mappings:Mapping[]}
const BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
const money=(c:number|null)=>c===null?'Unpriced':
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100)
const qty=(n:number)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:3})
async function req<T>(key:string,path:string,data?:unknown):Promise<T>{
  const r=await fetch(BASE+path,{method:data===undefined?'GET':'POST',cache:'no-store',
    headers:{'X-Starkeepsake-Admin-Key':key,
      ...(data===undefined?{}:{'Content-Type':'application/json'})},
    body:data===undefined?undefined:JSON.stringify(data)})
  if(!r.ok)throw new Error(r.status===401?'Invalid admin session.':
    r.status===503?'M6 requires migrations 003/004 and the Azure API release.':
    r.status===409?'Supplier mapping rejected: check M3 SKU.':
    'Procurement request failed (HTTP '+r.status+').')
  return r.json() as Promise<T>
}
export function ProcurementPanel({adminKey}:{adminKey:string}){
  const [data,setData]=useState<Response|null>(null)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [sku,setSku]=useState('')
  const [asin,setAsin]=useState('')
  const [pack,setPack]=useState('1')
  const [maxPrice,setMaxPrice]=useState('')
  const [enabled,setEnabled]=useState(false)
  useEffect(()=>{let live=true
    void req<Response>(adminKey,'/api/admin/procurement/preview')
      .then(x=>{if(live)setData(x)})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:'M6 unavailable.')})
    return()=>{live=false}
  },[adminKey])
  const refresh=async()=>{
    setBusy(true);setError('')
    try{setData(await req<Response>(adminKey,'/api/admin/procurement/preview'))}
    catch(e){setError(e instanceof Error?e.message:'Could not refresh.')}
    finally{setBusy(false)}
  }
  async function save(event:FormEvent){
    event.preventDefault()
    setBusy(true);setError('');setNotice('')
    try{
      if(maxPrice&&!/^\d+(\.\d{1,2})?$/.test(maxPrice))
        throw new Error('Use a valid USD unit cap with no more than two decimals.')
      await req(adminKey,'/api/admin/procurement/mapping',{
        sku:sku.trim().toUpperCase(),asin:asin.trim().toUpperCase(),
        packQuantity:Number(pack),
        maxUnitPriceCents:maxPrice?Math.round(Number(maxPrice)*100):null,enabled
      })
      setNotice('Mapping saved. No Amazon quote verified or purchase initiated.')
      setData(await req<Response>(adminKey,'/api/admin/procurement/preview'))
    }catch(e){setError(e instanceof Error?e.message:'Mapping failed.')}
    finally{setBusy(false)}
  }
  const preview=data?.preview
  return <section className="materials-section m6-panel" aria-label="M6 procurement simulation">
    <div className="materials-heading"><div>
      <p className="production-eyebrow">M6 / AMAZON BUSINESS PREPARATION</p>
      <h2>Procurement readiness</h2>
      <p>Review parts required for paid orders, physical stock, open supplier orders
        and potential Amazon pack quantities.</p>
    </div><button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh simulation</button></div>
    <p className="m6-locked">SIMULATION ONLY · AMAZON CHECKOUT DISABLED · NO SUPPLIER PURCHASES</p>
    {error&&<p role="alert" className="materials-error">{error}</p>}
    {notice&&<p role="status" className="materials-success">{notice}</p>}
    <div className="materials-metrics">
      <article><small>Eligible paid job BOMs</small><strong>{preview?.activePaidJobs??'—'}</strong></article>
      <article><small>Shortage SKUs</small><strong>{preview?.lines.length??'—'}</strong></article>
      <article><small>Estimated new parts</small><strong>{money(preview?.estimatedMaterialsCents??null)}</strong></article>
      <article><small>Ordering capability</small><strong>Locked</strong></article>
    </div>
    <p className="materials-explain">Estimates use manually entered M3 costs, NOT live Amazon Business pricing.
      No order will be placed. Outstanding supplier orders are deducted from additional requirements,
      but are not considered received stock.</p>
    <div className="materials-table-scroll"><table><thead><tr>
      <th>SKU</th><th>REQUIRED</th><th>ON HAND</th><th>ON ORDER</th>
      <th>MORE NEEDED</th><th>AMAZON ASIN</th><th>PACKS</th><th>EST. COST</th>
    </tr></thead><tbody>{preview?.lines.map(l=><tr key={l.sku}>
      <td><strong>{l.sku}</strong><small>{l.name}</small></td>
      <td>{qty(l.required)} {l.unit}</td><td>{qty(l.onHand)}</td><td>{qty(l.onOrder)}</td>
      <td>{qty(l.netToOrder)}</td><td>{l.asin??'Not mapped'}</td>
      <td>{l.packsToBuy??'—'}</td><td>{money(l.estimatedPurchaseCents)}</td>
    </tr>)}</tbody></table>
    {!preview?.lines.length&&<p className="materials-empty">
      No shortage items from eligible paid production-job BOMs.</p>}</div>
    <div className="materials-grid">
      <form onSubmit={e=>void save(e)} className="materials-form">
        <h3>Map a material to an Amazon Business ASIN</h3>
        <p>Only for future integration. Enabling a mapping does not authorize purchases.</p>
        <label>Existing M3 part SKU <input required value={sku} onChange={e=>setSku(e.target.value.toUpperCase())}
          placeholder="FRAME-WALNUT" pattern="[A-Z0-9_-]{2,40}"/></label>
        <label>Amazon ASIN <input required minLength={10} maxLength={10} value={asin}
          onChange={e=>setAsin(e.target.value.toUpperCase())} placeholder="10-character ASIN"/></label>
        <label>Units per supplier pack <input required type="number" min=".001" max="100000"
          step=".001" value={pack} onChange={e=>setPack(e.target.value)}/></label>
        <label>Maximum allowed unit cost in USD <input placeholder="Leave blank to block"
          value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} inputMode="decimal"/></label>
        <label className="m6-checkbox"><input type="checkbox" checked={enabled}
          onChange={e=>setEnabled(e.target.checked)}/> Include mapping in estimates</label>
        <button type="submit" className="production-primary" disabled={busy}>Save mapping (no checkout)</button>
      </form>
      <div className="materials-form">
        <h3>Next step for live Amazon Business integration</h3>
        <p>Amazon Business requires an approved API developer profile, authorized
          buying account, Business Product Catalog role, Ordering API access,
          and account payment and buying-group safeguards.</p>
        <p>Live offer verification, shipping/tax estimates, spend thresholds,
          explicit owner approval, idempotent ordering and reconciliation are
          not connected yet.</p>
        <p><a href="https://docs.business.amazon.com/docs/ordering-api" target="_blank"
          rel="noopener noreferrer">Amazon Business Ordering API documentation</a></p>
        <h3>Saved product mappings</h3>
        {!data?.mappings.length?<p>No mappings yet.</p>:
          <ul>{data.mappings.map(m=><li key={m.sku}>{m.sku}: {m.asin} ·
            {qty(m.pack_quantity)} units/pack · {m.enabled?'enabled for estimates':'disabled'}</li>)}</ul>}
      </div>
    </div>
    <p className="materials-footnote">Every simulated line remains blocked from live ordering.
      No payment methods, customer delivery addresses or Amazon credentials are stored in this interface.</p>
  </section>
}
