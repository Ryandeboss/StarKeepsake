import {useEffect,useState} from 'react'
import {downloadFile} from '../customerOrder'
import {supplierCandidateFor} from '../supplierCandidates'
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
export function OwnerManufacturingPlan({plan,materials,receiptId,transactionId}:{
  plan:MakerPlan;materials:MaterialSnapshot|null;receiptId:number;transactionId:number
}){
  const localKey='starkeepsake-owner-checks:v1:'+receiptId+':'+transactionId+':'+plan.designId
  const [done,setDone]=useState<Record<string,boolean>>(()=>{
    try{
      const raw=localStorage.getItem(localKey)
      const saved=raw?JSON.parse(raw) as Record<string,boolean>:{}
      return Object.fromEntries(plan.steps.map(s=>[s.id,saved[s.id]===true]))
    }catch{return {}}
  })
  useEffect(()=>{
    try{localStorage.setItem(localKey,JSON.stringify(done))}catch{/** export still works */}
  },[localKey,done])
  const complete=plan.steps.filter(s=>done[s.id]).length
  const getDownload=(name:string,body:string,mime:string)=>
    downloadFile(new Blob([body],{type:mime}),plan.designId+'-'+name)
  const savedChecklist=()=>JSON.stringify({
    ...JSON.parse(makerChecklistJson(plan)),
    receiptId,transactionId,
    warning:'Browser-only checklist state. NOT an authorized production-job workflow or server-side audit.',
    steps:plan.steps.map(s=>({...s,status:done[s.id]?'checked_locally':'not_started'}))
  },null,2)
  return <section className="omp-panel" aria-label="Saved-design physical manufacturing plan">
    <div className="omp-header">
      <div><span className="omp-kicker">VERIFIED PAID JOB · SAVED DESIGN READ ONLY</span>
        <h4>Exact design manufacturing review</h4></div>
      <span className="omp-hold">PRODUCTION HOLD</span>
    </div>
    <p className="omp-alert">This is an automatically calculated <b>candidate</b>
      component list, not a verified supplier order or approval to manufacture.
      Etsy frame variation, safety, parts, print alignment and actual stock must be reviewed.</p>
    <div className="omp-summary">
      <article><small>Saved illuminated stars</small><b>{plan.physicalCount}</b></article>
      <article><small>TLC5947 boards · 24 channels</small><b>{plan.driverCount}</b></article>
      <article><small>12-channel connector groups</small><b>{plan.connectorGroupCount}</b></article>
      <article><small>Chosen finish</small><b>{plan.product.frameFinish}</b></article>
    </div>
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
    <div className="omp-section-title"><h4>Job-specific parts, derived from N = {plan.physicalCount}</h4>
      <small>Stock is global, not reserved for this job. Research listing links are not
        approved supplier SKUs, price quotes, availability, or tested component compatibility.</small></div>
    {groups.map(group=><details key={group.id} className="omp-details" open>
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
    <details className="omp-details">
      <summary>Build and QA checklist — {complete} / {plan.steps.length} checked on this browser</summary>
      <p>This list is <b>local to this browser only</b>, not durable job progress
        or evidence of safety approval. Download the JSON after each session.
        No step changes Etsy or server production status.</p>
      <div className="omp-checklist">{plan.steps.map((s,i)=><label key={s.id}>
        <input type="checkbox" checked={Boolean(done[s.id])}
          onChange={e=>setDone(prev=>({...prev,[s.id]:e.target.checked}))}/>
        <span>{i+1}. {s.title}</span></label>)}</div>
      <button type="button" onClick={()=>getDownload('build-checklist-LOCAL.json',
        savedChecklist(),'application/json')}>↓ Export local checklist progress</button>
    </details>
  </section>
}
