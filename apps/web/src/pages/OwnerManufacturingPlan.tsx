import {useEffect,useState} from 'react'
import {downloadFile} from '../customerOrder'
import {supplierCandidateFor} from '../supplierCandidates'
import {RehearsalWorkbench} from './RehearsalWorkbench'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import type {MakerGroup,MakerPart,MakerPlan} from '../manufacturingJobPlan'
import {makerPartsCsv,makerStarMapCsv,makerDrillTemplateSvg,makerChecklistJson}
  from '../manufacturingJobPlan'
import './OwnerManufacturingPlan.css'

const groups:readonly {id:MakerGroup;name:string;intro:string}[]=[
  {id:'buy',name:'Buy specifically for this order',
    intro:'Frame finish, professional print and print shop expense. Confirm exact Etsy variation and final quote.'},
  {id:'pack',name:'Pack Stock — consume per frame',
    intro:'Individual electronics, connector sets and packaging. These are not approved vendor SKUs.'},
  {id:'bulk',name:'Bulk Stock — cut and consume',
    intro:'Film, wire, adhesives, PVC board and strip stock. Unknown lengths remain TO MEASURE.'},
  {id:'make',name:'Make for this order',
    intro:'Fabrication and assembly tasks, based on the saved physical-star count.'},
]
const unitName=(x:number|null,unit:string)=>x===null?'TO MEASURE':x+' '+unit
function stockSnapshot(part:MakerPart,materials:MaterialSnapshot|null){
  const sku=part.skuHint?.toLowerCase()
  const found=sku?materials?.parts.find(p=>p.sku.toLowerCase()===sku):undefined
  if(!found)return null
  const pending=materials!.purchases.filter(p=>p.sku===found.sku&&
    ['ordered','partially_received'].includes(p.status)).reduce(
    (acc,p)=>acc+Math.max(0,Number(p.quantity_ordered)-Number(p.quantity_received)),0)
  return {found,pending,estimate:part.quantity!==null?
    Math.max(0,part.quantity-Number(found.on_hand)):null}
}
function safeLink(url:string|null|undefined){
  return url&&/^https:\/\//i.test(url)?url:null
}
export function OwnerManufacturingPlan({plan,materials,receiptId,transactionId,
  adminKey,simulated=false,module='all'}:{
  plan:MakerPlan;materials:MaterialSnapshot|null;receiptId:number;transactionId:number;
  adminKey:string;simulated?:boolean;module?:'all'|'files'|'parts'|'checklist'
}){
  const [done,setDone]=useState<Record<string,boolean>>({})
  const [serverReady,setServerReady]=useState(false)
  const [progressError,setProgressError]=useState('')
  const [pending,setPending]=useState('')
  const endpoint=simulated?
    '/api/production/simulate?designId='+encodeURIComponent(plan.designId)+'&view=checklist':
    '/api/production/checklist?receiptId='+receiptId+'&transactionId='+transactionId
  useEffect(()=>{
    let active=true
    void (async()=>{
      try{
        const response=await fetch(endpoint,{cache:'no-store',
          headers:{'X-Starkeepsake-Admin-Key':adminKey}})
        if(!response.ok)throw Error('Server checklist unavailable (HTTP '+
          response.status+').')
        const json=await response.json() as {
          durable:boolean;progress:Record<string,{checked:boolean;updatedAt:string}>}
        if(!json.durable)throw Error('Server did not confirm durable checklist.')
        if(!active)return
        setDone(Object.fromEntries(plan.steps.map(step=>[
          step.id,json.progress[step.id]?.checked===true
        ])))
        setProgressError('');setServerReady(true)
      }catch(error){
        if(active){setServerReady(false);setProgressError(
          error instanceof Error?error.message:'Server checklist unavailable.')}
      }
    })()
    return()=>{active=false}
  },[adminKey,endpoint,plan])
  async function updateStep(id:string,checked:boolean){
    if(!serverReady||pending)return
    setPending(id);setProgressError('')
    try{
      const response=await fetch(endpoint,{method:'POST',cache:'no-store',
        headers:{'Content-Type':'application/json',
          'X-Starkeepsake-Admin-Key':adminKey},
        body:JSON.stringify({stepId:id,checked})})
      if(!response.ok)throw Error('Server checklist write failed (HTTP '+
        response.status+').')
      const result=await response.json() as {durable:boolean}
      if(!result.durable)throw Error('Server did not confirm the saved step.')
      setDone(prev=>({...prev,[id]:checked}))
    }catch(error){
      setProgressError(error instanceof Error?error.message:
        'Could not save production checklist step.')
    }finally{setPending('')}
  }
  const complete=plan.steps.filter(s=>done[s.id]).length
  const getDownload=(name:string,body:string,mime:string)=>
    downloadFile(new Blob([body],{type:mime}),plan.designId+'-'+name)
  const savedChecklist=()=>JSON.stringify({
    ...JSON.parse(makerChecklistJson(plan)),
    receiptId,transactionId,
    warning:simulated?
      'SIMULATION ONLY. Private test progress, not paid, certified or authorized to ship.':
      'Private Vercel Blob server-persisted checklist. Not an audited electrical safety approval or authorization to ship.',
    steps:plan.steps.map(s=>({...s,status:done[s.id]?'saved_on_server':'not_started'}))
  },null,2)
  return <section className="omp-panel" aria-label="Saved-design physical manufacturing plan">
    <div className="omp-header">
      <div><span className="omp-kicker">{simulated?
          'SIMULATED UNPAID TEST · EXACT SAVED DESIGN':
          'VERIFIED PAID JOB · SAVED DESIGN READ ONLY'}</span>
        <h4>Exact design manufacturing review</h4></div>
      <span className="omp-hold">PRODUCTION HOLD</span>
    </div>
    <p className="omp-alert">This is an automatically calculated <b>candidate</b>
      component list, not a verified supplier order or approval to manufacture.
      Etsy frame variation, safety, parts, print alignment and actual stock must be reviewed.</p>
    {simulated&&<RehearsalWorkbench plan={plan} adminKey={adminKey}
      materials={materials} view={module==='parts'?'parts':
        module==='checklist'?'checklist':'all'}/>}

    {(module==='all'||(module==='parts'&&!simulated))&&<>
    <div className="omp-summary">
      <article><small>Saved illuminated stars</small><b>{plan.physicalCount}</b></article>
      <article><small>TLC5947 boards · 24 channels</small><b>{plan.driverCount}</b></article>
      <article><small>12-channel connector groups</small><b>{plan.connectorGroupCount}</b></article>
      <article><small>Chosen finish</small><b>{plan.product.frameFinish}</b></article>
    </div>
    {module==='all'&&<>
    <p><b>Customer's sky:</b> {plan.astronomy.date},
      {' '}{plan.astronomy.time??'time not specified'} ·
      {' '}{plan.astronomy.location?.displayName??'Location unresolved'} ·
      {' '}{plan.product.skyLayout} ·
      {' '}{plan.product.trimWidthMm} × {plan.product.trimHeightMm} mm
      {' '}({plan.product.orientation})</p>
    <p><b>Inscription:</b> {plan.product.inscription||'None'}</p>
    <p><b>Design schema:</b> {plan.schemaVersion} · <b>Star choices:</b>
      {' '}{plan.manualSelection?'Manually selected':'Automatically selected'} ·
      configured max {plan.configuredMax??'unknown'}</p>
    <div className="omp-alert" role="status">
      <b>Manufacturing holds to clear</b>
      <ul>{plan.holds.map((hold,i)=><li key={i}>{hold}</li>)}</ul>
    </div>
    <div className="omp-actions">
      <button type="button" onClick={()=>getDownload('candidate-bom.csv',
        makerPartsCsv(plan),'text/csv')}>↓ Per-order parts CSV</button>
      <button type="button" onClick={()=>getDownload('star-map.csv',
        makerStarMapCsv(plan),'text/csv')}>↓ N-star coordinate CSV</button>
      <button type="button" onClick={()=>getDownload('manufacturing-review.json',
        JSON.stringify(plan,null,2),'application/json')}>↓ Manufacturing JSON</button>
      <button type="button" disabled={!plan.geometryValidated}
        title={plan.geometryValidated?'Print at 100%; physical registration still mandatory':
          'Saved physical star coordinates invalid or incomplete'}
        onClick={()=>getDownload('drill-template-DRAFT-1to1.svg',
          makerDrillTemplateSvg(plan),'image/svg+xml')}>
        ↓ 1:1 drill template (UNVERIFIED)
      </button>
    </div>
    <details className="omp-details" open>
      <summary>Exact physical-star list — {plan.physicalCount} channels</summary>
      <div className="omp-scroll"><table><thead><tr>
        <th>LED</th><th>HIP</th><th>Magnitude</th><th>X mm</th><th>Y mm</th>
        <th>Hole mm</th><th>Selection</th><th>PWM</th></tr></thead>
        <tbody>{plan.stars.map((s,i)=><tr key={i}>
          <td>{s.ledIndex}</td><td>{s.hipparcosId}</td>
          <td>{s.magnitude.toFixed(2)}</td>
          <td>{s.printXMm?.toFixed(3)??'HOLD'}</td>
          <td>{s.printYMm?.toFixed(3)??'HOLD'}</td>
          <td>{s.holeSizeMm??'HOLD'}</td>
          <td>{s.selectionReason}</td><td>Not calibrated</td>
        </tr>)}</tbody></table></div>
    </details>
    </>}
    <div className="omp-section-title"><h4>Job-specific parts, derived from N = {plan.physicalCount}</h4>
      <small>Stock is global, not reserved for this job. Research listing links are not
        approved supplier SKUs, price quotes, availability, or tested component compatibility.</small></div>
    {groups.map(group=><details key={group.id} className="omp-details"
      open={module==='all'||group.id==='buy'}>
      <summary>{group.name} · {plan.parts.filter(p=>p.group===group.id).length} entries</summary>
      <p>{group.intro}</p>
      <div className="omp-scroll"><table><thead><tr>
        <th>Component</th><th>Job quantity</th><th>Formula</th>
        <th>M3 global on hand / incoming</th><th>Supplier / recorded price</th><th>Readiness</th>
      </tr></thead><tbody>{plan.parts.filter(p=>p.group===group.id).map(p=>{
        const stock=stockSnapshot(p,materials)
        const vendor=stock?.found
        const link=safeLink(vendor?.supplier_url)
        const candidate=supplierCandidateFor(p.key)
        return <tr key={p.key}>
          <td><b>{p.name}</b><small>{p.notes}</small></td>
          <td>{unitName(p.quantity,p.unit)}</td>
          <td>{p.rule}</td>
          <td>{stock?<>
            {stock.found.on_hand} on hand / {stock.pending} incoming
            <small>Provisional gap {stock.estimate??'TBD'} · not reserved</small>
          </>:'Not in verified M3 catalog'}</td>
          <td>{link?<a href={link} target="_blank" rel="noopener noreferrer">
              Recorded M3 supplier link</a>:
            candidate?<a href={candidate.url} target="_blank" rel="noopener noreferrer">
              Research listing · {candidate.supplier}</a>:'No researched listing'}
            {candidate&&!link&&<small>{candidate.product}.
              {' '}Listed as of {candidate.checked}. Compatibility HOLD: {candidate.notes}</small>}
            {vendor?.unit_cost_cents!=null&&
              <small>Recorded unit price ${(vendor.unit_cost_cents/100).toFixed(2)};
                shipping and tax not included</small>}
          </td>
          <td><span className="omp-status">{p.review.replace(/_/g,' ')}</span></td>
        </tr>
      })}</tbody></table></div>
    </details>)}
    </>}
    {!simulated&&(module==='all'||module==='checklist')&&<details className="omp-details">
      <summary>Build and QA checklist — {complete} / {plan.steps.length} steps saved</summary>
      <p>{serverReady?(simulated?
        'Your test-only checklist is saved privately and will reload on another device.':
        'Your progress is stored privately on Vercel and will reload on other devices.'):
        'Checking private server storage. Editing stays disabled until it is available.'}
        {' '}Step completion does not replace physical quality inspection,
        certification or owner permission to ship.</p>
      {progressError&&<p role="alert" className="production-error">{progressError}</p>}
      <div className="omp-checklist">{plan.steps.map((s,i)=><label key={s.id}>
        <input type="checkbox" checked={Boolean(done[s.id])}
          disabled={!serverReady||Boolean(pending)}
          onChange={e=>void updateStep(s.id,e.target.checked)}/>
        <span>{i+1}. {s.title}</span></label>)}</div>
      <button type="button" disabled={!serverReady}
        onClick={()=>getDownload('build-checklist-SERVER.json',
        savedChecklist(),'application/json')}>↓ Export saved checklist JSON</button>
    </details>}
  </section>
}
