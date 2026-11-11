import {useCallback,useEffect,useState} from 'react'
import './M6SimulationPanel.css'

type SimLine={sku:string;asin:string;packs:number;additionalParts:number;
  catalogEstimateCents:number}
type Assessment={mode:string;simulationOnly:boolean;readyForActualCheckout:boolean;
  canSaveDraft:boolean;canReviewSimulation:boolean;estimatedSubtotalCents:number|null;
  perOrderCapCents:number;dailyCapCents:number;alreadyReviewedTodayCents:number;
  blocks:string[];liveOrderingBlocks:string[];lines:SimLine[]}
type Simulation={simulation_id:string;status:'draft'|'simulated_reviewed'|'voided';
  estimated_subtotal_cents:number;per_order_cap_cents:number;daily_cap_cents:number;
  created_at:string;reviewed_at:string|null;voided_at:string|null}
type Ledger={simulations:Simulation[];simulationOnly:boolean;checkoutEnabled:boolean}
const BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
const usd=(c:number|null)=>c===null?'Unavailable':new Intl.NumberFormat(
  'en-US',{style:'currency',currency:'USD'}).format(c/100)
function readCap(value:string):number{
  if(!/^\d{1,7}(\.\d{1,2})?$/.test(value))throw new Error(
    'Enter a positive USD amount with at most two decimal places.')
  const cents=Math.round(Number(value)*100)
  if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)
    throw new Error('Hypothetical spending cap must be between $0.01 and $1,000,000.')
  return cents
}
async function api<T>(key:string,path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(BASE+path,{method,cache:'no-store',
    headers:{'X-Starkeepsake-Admin-Key':key,
      ...(body===undefined?{}:{'Content-Type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body)})
  if(!response.ok){
    if(response.status===401)throw new Error('Owner session no longer authorized.')
    if(response.status===404||response.status===503)
      throw new Error('M6.3 preview needs its separate API release and migration 005.')
    if(response.status===409)
      throw new Error('This simulation was rejected: budget, snapshot or review state changed.')
    throw new Error('Simulation request failed: HTTP '+response.status)
  }
  return response.json() as Promise<T>
}
export function M6SimulationPanel({adminKey}:{adminKey:string}){
  const [perOrder,setPerOrder]=useState('500')
  const [perDay,setPerDay]=useState('1000')
  const [assessment,setAssessment]=useState<Assessment|null>(null)
  const [ledger,setLedger]=useState<Ledger|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const load=useCallback(async()=>{
    setLedger(await api<Ledger>(adminKey,'/api/admin/procurement/simulations'))
  },[adminKey])
  useEffect(()=>{let alive=true
    void api<Ledger>(adminKey,'/api/admin/procurement/simulations')
      .then(data=>{if(alive)setLedger(data)})
      .catch(err=>{if(alive)setError(err instanceof Error?err.message:'Simulation ledger offline.')})
    return()=>{alive=false}
  },[adminKey])
  function limits(){return{
    perOrderCapCents:readCap(perOrder),
    dailyCapCents:readCap(perDay)
  }}
  async function run(action:'evaluate'|'save'){
    setBusy(true);setError('');setNotice('')
    try{
      const result=action==='evaluate'?
        await api<Assessment>(adminKey,'/api/admin/procurement/simulations/evaluate','POST',limits()):
        await api<{simulation_id:string;status:string;replayed:boolean;simulation_only:boolean}>(
          adminKey,'/api/admin/procurement/simulations/save','POST',limits())
      if(action==='evaluate')setAssessment(result as Assessment)
      else {
        const receipt=result as {simulation_id:string;replayed:boolean}
        setNotice(receipt.replayed?'Existing snapshot reused; no duplicate proposal created.':
          'Simulation saved. No vendor order or charge was created.')
        await load()
      }
    }catch(err){setError(err instanceof Error?err.message:'Simulation failed.')}
    finally{setBusy(false)}
  }
  async function change(id:string,action:'review'|'void'){
    setBusy(true);setError('');setNotice('')
    try{
      await api<unknown>(adminKey,
        '/api/admin/procurement/simulations/'+encodeURIComponent(id)+'/'+action,
        'POST',action==='review'?{acknowledgeSimulationOnly:true}:{})
      setNotice(action==='review'?
        'Recorded as reviewed IN SIMULATION ONLY. No supplier order was placed.':
        'Draft simulation voided; this did not change stock or orders.')
      await load()
    }catch(err){setError(err instanceof Error?err.message:'Action rejected.')}
    finally{setBusy(false)}
  }
  return <section className="materials-section m6-sim" aria-label="M6 purchasing simulation">
    <div className="materials-heading"><div>
      <p className="production-eyebrow">M6.3 / DRY-RUN PURCHASE SAFEGUARDS</p>
      <h2>Purchasing simulator</h2>
      <p>Rehearse shortages, budget limits, duplicate-proposal protection and
        simulated reviews without making any real purchase.</p>
    </div></div>
    <p className="m6-sim-lock" role="status">SIMULATION ONLY · NO AMAZON ORDERING ACCESS · NO CHARGES</p>
    <div className="m6-sim-budget">
      <label>Hypothetical per-order limit (USD)
        <input type="text" inputMode="decimal" value={perOrder}
          onChange={e=>{setPerOrder(e.target.value);setAssessment(null)}}/>
      </label>
      <label>Hypothetical daily limit (USD)
        <input type="text" inputMode="decimal" value={perDay}
          onChange={e=>{setPerDay(e.target.value);setAssessment(null)}}/>
      </label>
      <button type="button" disabled={busy} onClick={()=>void run('evaluate')}>
        {busy?'Working…':'Evaluate paid-job shortages'}</button>
    </div>
    <p className="m6-sim-help">These are experimental test values, not configured
      business purchasing permissions. Actual ordering remains hard-disabled.</p>
    {error&&<p className="materials-error" role="alert">{error}</p>}
    {notice&&<p className="materials-success" role="status">{notice}</p>}
    {assessment&&<div className="m6-sim-report">
      <div className="materials-metrics">
        <article><small>Estimated materials</small><strong>{usd(assessment.estimatedSubtotalCents)}</strong></article>
        <article><small>Simulated today</small><strong>{usd(assessment.alreadyReviewedTodayCents)}</strong></article>
        <article><small>Lines</small><strong>{assessment.lines.length}</strong></article>
        <article><small>Real checkout</small><strong>Disabled</strong></article>
      </div>
      <div className="materials-table-scroll"><table><thead><tr>
        <th>SKU / ASIN</th><th>NEW PARTS NEEDED</th><th>SIMULATED PACKS</th><th>M3 ESTIMATE</th>
      </tr></thead><tbody>{assessment.lines.map(l=><tr key={l.sku}>
        <td>{l.sku}<small>{l.asin}</small></td><td>{l.additionalParts}</td>
        <td>{l.packs}</td><td>{usd(l.catalogEstimateCents)}</td>
      </tr>)}</tbody></table></div>
      {assessment.blocks.length>0&&<p className="materials-error" role="alert">
        Cannot save simulation: {assessment.blocks.join(' · ').replaceAll('_',' ')}</p>}
      <p className="m6-sim-warn">Live ordering remains blocked: {assessment.liveOrderingBlocks.join(' · ').replaceAll('_',' ')}</p>
      <button type="button" className="production-primary" disabled={busy||!assessment.canSaveDraft}
        onClick={()=>void run('save')}>Save simulated proposal — no purchase</button>
    </div>}
    <div className="m6-sim-ledger">
      <div className="materials-heading"><h3>Simulation audit ledger</h3>
        <button type="button" onClick={()=>void load().catch(()=>setError('Could not load ledger.'))}
          disabled={busy}>Refresh</button></div>
      {!ledger?.simulations.length&&<p>No simulated proposals yet. Actual Etsy purchases are not needed to explore the controls,
        but saving a proposal requires an eligible verified paid-job BOM.</p>}
      <div className="materials-table-scroll"><table><thead><tr>
        <th>CREATED</th><th>SIMULATION</th><th>ESTIMATE</th><th>STATUS</th><th>ACTIONS</th>
      </tr></thead><tbody>{ledger?.simulations.map(s=><tr key={s.simulation_id}>
        <td>{new Date(s.created_at).toLocaleString()}</td>
        <td><code>{s.simulation_id.slice(0,8)}</code></td>
        <td>{usd(s.estimated_subtotal_cents)}</td>
        <td>{s.status.replaceAll('_',' ')}</td>
        <td>{s.status==='draft'&&<div className="m6-sim-actions">
          <button type="button" disabled={busy} onClick={()=>void change(s.simulation_id,'review')}>
            Mark simulated review (never buy)</button>
          <button type="button" disabled={busy} onClick={()=>void change(s.simulation_id,'void')}>
            Void simulation</button>
        </div>}</td>
      </tr>)}</tbody></table></div>
    </div>
    <p className="materials-footnote">Simulation ledger records are separate from real
      supplier purchases, inventory adjustments and Amazon Business orders. They cannot
      be exported as approved purchase orders or used for checkout.</p>
  </section>
}
