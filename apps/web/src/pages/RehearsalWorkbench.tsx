import {useEffect,useState} from 'react'
import {downloadFile} from '../customerOrder'
import type {MakerPlan,MakerPart} from '../manufacturingJobPlan'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import {supplierCandidateFor} from '../supplierCandidates'
import {PRINT_VARIANTS} from '../manufacturingPrint'
import phases from '../rehearsalPhases.json'
import './RehearsalWorkbench.css'

type SavedStep={checked:boolean;updatedAt:string}
type SavedPart={status:string;validation:string;notes:string;updatedAt:string}
type SavedEvidence={value:string;updatedAt:string}
type SavedPrint={variant:string;supplier:string;notes:string;approved:boolean}
type WorkState={
  durable:boolean;version:string;testOrderId:string;buildStatus:string;
  packetVersion:string|null;planVersion:string|null;
  readyToBuild:boolean;completedAt:string|null;
  done:number;total:number;blockers:string[];completionBlockers:string[];
  steps:Record<string,SavedStep>;parts:Record<string,SavedPart>;
  evidence:Record<string,SavedEvidence>;print:SavedPrint|null;
  photos:{photoId:string;name:string;ext:string;uploadedAt:string}[]
}
const statuses=[
  ['needed','Needed'],['in_stock','In stock'],['need_to_buy','Need to buy'],
  ['ordered','Ordered'],['shipped','Shipped'],['delivered','Delivered'],
  ['inspected','Inspected'],['allocated','Allocated to this job'],
  ['ready','Ready for this build'],['not_applicable','Not applicable (explain)'],
] as const
const validations=[
  ['research_candidate','Research candidate'],['datasheet_checked','Datasheet checked'],
  ['bench_tested','Bench tested'],['fit_tested','Fit tested'],
  ['optical_tested','Optical tested'],['electrical_tested','Electrical tested'],
  ['thermal_tested','Thermal / burn-in tested'],
  ['production_approved','Production approved (owner assertion only)'],
] as const
const evidenceGroups=[
  {title:'Physical setup and print proof',rows:[
    ['frameFit','Frame dimensions, rabbet/depth and measured fit'],
    ['printProof','Printed alignment, trim, lab proof and TOP'],
    ['calibratedPodFit','StarPod bore and fit coupon results'],
    ['measuredWireLength','Wire routing and measured lengths']]},
  {title:'Electrical schematic and controlled power-up',rows:[
    ['firmwarePinMap','TLC5947 firmware version and reviewed DIN/CLK/LAT pin map'],
    ['powerSupply','Validated PSU, connector, fuse and current-limited setup'],
    ['supplyCurrent','Measured operating supply current (mA or A)'],
    ['channelWalk','LED 0…N−1 mapping and polarity inspection results']]},
  {title:'Optics and burn-in',rows:[
    ['opticalTest','Dark room, brightness, leakage, twinkle and accent results'],
    ['burnInStart','Burn-in start (date and time)'],
    ['burnInEnd','Burn-in end (date and time)'],
    ['burnInDuration','Measured burn-in duration'],
    ['picoTemperature','Pico temperature, if measured (°C)'],
    ['driverTemperature','Driver temperature (°C)'],
    ['frameTemperature','Internal/frame temperature (°C)'],
    ['burnInAnomalies','Anomalies, fault response, rework and retest']]},
  {title:'Final inspection and packaging',rows:[
    ['qaInspector','Inspector/date and QA outcome'],
    ['qaNotes','Final QA results and defects/rework'],
    ['inspectionPhotos','Private inspection photo reference or location (no public link)'],
    ['packagingNotes','Packaging, care insert, adapter protection and final checks'],
    ['buildNotes','Anything to improve before first real paid production']]},
] as const
const groupInfo=[
  ['buy','BUY FOR THIS ORDER'],
  ['pack','PACK STOCK · COUNT PER FRAME'],
  ['bulk','BULK STOCK · MEASURE CONSUMPTION'],
  ['make','MAKE FOR THIS ORDER'],
] as const

function PartEditor({part,current,materials,onSave,busy}:{
  part:MakerPart;current?:SavedPart;materials:MaterialSnapshot|null;
  onSave:(value:{kind:'part';key:string;status:string;validation:string;notes:string})=>Promise<void>;
  busy:boolean
}){
  const [status,setStatus]=useState(current?.status||'needed')
  const [validation,setValidation]=useState(current?.validation||'research_candidate')
  const [notes,setNotes]=useState(current?.notes||'')
  const listed=supplierCandidateFor(part.key)
  const stock=part.skuHint?materials?.parts.find(m=>m.sku.toLowerCase()===
    part.skuHint?.toLowerCase()):null
  return <div className="rw-part-row">
    <div className="rw-part-description">
      <strong>{part.name}</strong>
      <small>{part.quantity===null?'TO MEASURE':part.quantity+' '+part.unit}
        {' · '}{part.required?'Required':'Conditional'} · {part.rule}</small>
      <small>{part.notes}</small>
      {listed?<div className="rw-source">
        <a href={listed.url} target="_blank" rel="noopener noreferrer">{listed.supplier} · {listed.product}</a>
        <span>Source confidence: {listed.sourceConfidence}</span>
        <span>Build validation: {current?.validation?.replace(/_/g,' ')||listed.buildValidation}</span>
      </div>:<div className="rw-source">
        <span>Supplier: Not selected</span><span>Source confidence: Unknown — Do Not Purchase</span>
        <span>Build validation: HOLD</span>
      </div>}
      <small>Global M3 stock: {stock?stock.on_hand+' '+stock.unit+' on hand (NOT reserved)':
        'not confirmed'} · job allocation must be recorded separately.</small>
    </div>
    <div className="rw-part-edit">
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>
        {statuses.map(([v,label])=><option key={v} value={v}>{label}</option>)}
      </select></label>
      <label>Physical validation<select value={validation}
        onChange={e=>setValidation(e.target.value)}>
        {validations.map(([v,label])=><option key={v} value={v}>{label}</option>)}
      </select></label>
      <label>Order-specific notes<input value={notes} maxLength={500}
        onChange={e=>setNotes(e.target.value)}
        placeholder="SKU, quantity, supplier, cost, tests, purchase reference…"/></label>
      <button type="button" disabled={busy} onClick={()=>void onSave({
        kind:'part',key:part.key,status,validation,notes
      })}>{busy?'Saving…':'Save this part'}</button>
    </div>
  </div>
}
function EvidenceEditor({code,label,value,onSave,busy}:{
  code:string;label:string;value:string;
  onSave:(value:{kind:'evidence';key:string;value:string})=>Promise<void>;busy:boolean
}){
  const [draft,setDraft]=useState(value)
  return <label className="rw-evidence-row">
    <span>{label}</span>
    <input value={draft} maxLength={1000} onChange={e=>setDraft(e.target.value)}
      placeholder="Record actual result or measured value, not a guess"/>
    <button type="button" disabled={busy} onClick={()=>void onSave({
      kind:'evidence',key:code,value:draft
    })}>{busy?'Saving…':'Save'}</button>
  </label>
}

/** Reuses the same exact frozen N-star plan as the genuine owner manufacturing UI.
 * All write operations are owner-authenticated and isolated from Etsy jobs. */
export function RehearsalWorkbench({plan,adminKey,materials,view='all'}:{
  plan:MakerPlan;adminKey:string;materials:MaterialSnapshot|null;
  view?:'all'|'parts'|'checklist'
}){
  const [work,setWork]=useState<WorkState|null>(null)
  const [failure,setFailure]=useState('')
  const [busy,setBusy]=useState('')
  const [printVariant,setPrintVariant]=useState('exact')
  const [printLab,setPrintLab]=useState('')
  const [printNote,setPrintNote]=useState('')
  const [printApproved,setPrintApproved]=useState(false)
  const [qcPhoto,setQcPhoto]=useState<File|null>(null)
  const [qcLabel,setQcLabel]=useState('Final QC')
  const endpoint='/api/production/simulate?designId='+encodeURIComponent(plan.designId)+'&view=work'
  async function load(){
    const res=await fetch(endpoint,{cache:'no-store',
      headers:{'X-Starkeepsake-Admin-Key':adminKey}})
    if(!res.ok)throw Error('Cannot load this test work order (HTTP '+res.status+').')
    const state=await res.json() as WorkState
    if(!state.durable)throw Error('The server did not confirm durable test storage.')
    setWork(state)
    return state
  }
  useEffect(()=>{
    let active=true
    void (async()=>{
      try{
        const res=await fetch(endpoint,{cache:'no-store',
          headers:{'X-Starkeepsake-Admin-Key':adminKey}})
        if(!res.ok)throw Error('Cannot load test progress (HTTP '+res.status+').')
        const state=await res.json() as WorkState
        if(!active)return
        setWork(state)
        setPrintVariant(state.print?.variant||'exact')
        setPrintLab(state.print?.supplier||'')
        setPrintNote(state.print?.notes||'')
        setPrintApproved(state.print?.approved||false)
      }catch(error){if(active)setFailure(error instanceof Error?error.message:'Test storage unavailable.')}
    })()
    return()=>{active=false}
  },[endpoint,adminKey])
  async function save(data:Record<string,unknown>,key:string){
    if(busy)return
    setBusy(key);setFailure('')
    try{
      const res=await fetch(endpoint,{method:'POST',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Starkeepsake-Admin-Key':adminKey},
        body:JSON.stringify(data)})
      if(!res.ok){
        const body=await res.json().catch(()=>null) as {error?:string}|null
        throw Error(body?.error||'Could not save test progress (HTTP '+res.status+').')
      }
      await load()
    }catch(error){setFailure(error instanceof Error?error.message:'Could not save this change.')}
    finally{setBusy('')}
  }
  async function uploadQc(){
    if(!qcPhoto||busy)return
    setBusy('qc-photo');setFailure('')
    try{
      const form=new FormData()
      form.append('photo',qcPhoto)
      form.append('label',qcLabel)
      const url='/api/production/simulate?designId='+
        encodeURIComponent(plan.designId)+'&view=photo'
      const res=await fetch(url,{method:'POST',cache:'no-store',
        headers:{'X-Starkeepsake-Admin-Key':adminKey},body:form})
      if(!res.ok){
        const details=await res.json().catch(()=>null) as {error?:string}|null
        throw Error(details?.error||'Private QC photo upload failed.')
      }
      await load()
      setQcPhoto(null);setQcLabel('Final QC')
    }catch(error){setFailure(error instanceof Error?error.message:'Could not save QC photograph.')}
    finally{setBusy('')}
  }
  async function downloadQc(photoId:string,ext:string){
    setBusy('download-photo');setFailure('')
    try{
      const url='/api/production/simulate?designId='+
        encodeURIComponent(plan.designId)+'&view=photo&photoId='+encodeURIComponent(photoId)
      const res=await fetch(url,{cache:'no-store',
        headers:{'X-Starkeepsake-Admin-Key':adminKey}})
      if(!res.ok)throw Error('Private QC photo unavailable.')
      downloadFile(await res.blob(),plan.designId+'-QC-'+photoId+'.'+ext)
    }catch(error){setFailure(error instanceof Error?error.message:'Could not open this photo.')}
    finally{setBusy('')}
  }
  const showParts=view==='all'||view==='parts'
  const showChecklist=view==='all'||view==='checklist'
  const topBlocker=work?.blockers[0]||'Review the next uncompleted checklist step'
  const next=phases.phases.flatMap(p=>p.steps).find(s=>work?.steps[s.id]?.checked!==true)
  return <section className="rw-workbench" aria-label="Persistent test-production rehearsal">
    <header className="rw-head">
      <div><span>INTERNAL TEST · {work?.testOrderId||plan.designId}</span>
        <h4>{view==='parts'?'Parts to source & track':
          view==='checklist'?'Build checklist & QA':
            work?.buildStatus?.replace(/_/g,' ')||'Loading test work order…'}</h4>
        <p>Original frozen manufacturing version: {work?.packetVersion||'checking…'} ·
          {' '}maker plan: {work?.planVersion||plan.version}</p></div>
      <b>NO REAL ETSY PAYMENT</b>
    </header>
    {failure&&<p className="production-error" role="alert">{failure}</p>}
    {showChecklist&&<div className="rw-overview">
      <div><small>CURRENT PHASE</small><strong>{
        phases.phases.find(p=>p.steps.some(s=>!work?.steps[s.id]?.checked))?.label||'Final review'
      }</strong></div>
      <div><small>NEXT ACTION</small><strong>{next?.title||'Review physical QA and completion gates'}</strong></div>
      <div><small>TOP HOLD</small><strong>{topBlocker}</strong></div>
      <div><small>REHEARSAL PROGRESS</small><strong>{work?.done??0} / {work?.total??0}</strong>
        <progress max={work?.total||1} value={work?.done||0}/></div>
    </div>}
    <p className="rw-notice">The checklist is your test build log, not an electrical
      certification or permission to fulfill a paid order. Real inventory is not
      reserved automatically, no supplier purchase is placed, and Etsy shipping remains untouched.</p>
    {showChecklist&&<section className="rw-section">
      <h5>Approved print file for this supplier</h5>
      <p>Choose the print variant only AFTER the printer explicitly confirms the
        document dimensions, trim and bleed. Use the original frozen files above.</p>
      <div className="rw-print-fields">
        <label>Print format<select value={printVariant} onChange={e=>{
          setPrintVariant(e.target.value);setPrintApproved(false)}}>
          {PRINT_VARIANTS.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
        </select></label>
        <label>Printer / lab<input maxLength={160} value={printLab}
          onChange={e=>{setPrintLab(e.target.value);setPrintApproved(false)}}
          placeholder="Lab that accepted these exact document dimensions"/></label>
        <label className="rw-wide">Written lab acceptance / trim proof note<input
          maxLength={800} value={printNote}
          onChange={e=>{setPrintNote(e.target.value);setPrintApproved(false)}}
          placeholder="Document size, paper, bleed acceptance, proof reviewed…"/></label>
      </div>
      <label className="rw-approval"><input type="checkbox" checked={printApproved}
        onChange={e=>setPrintApproved(e.target.checked)}/>
        I have confirmed the chosen lab accepts this file and approved the proof.</label>
      <button type="button" disabled={Boolean(busy)||!work} onClick={()=>void save({
        kind:'print',variant:printVariant,supplier:printLab,notes:printNote,
        approved:printApproved
      },'print')}>Save approved print variant</button>
      {work?.print?.approved&&<p className="rw-file-approved">
        <strong>Send THIS file to {work.print.supplier}:</strong>
        {' '}{PRINT_VARIANTS.find(v=>v.id===work.print?.variant)?.artwork}
        {' '}— from the ORIGINAL frozen packet above, not a regenerated copy.
      </p>}
    </section>}
    {showParts&&<section className="rw-section">
      <h5>Parts for this exact build · {plan.physicalCount} stars</h5>
      <p>{plan.physicalCount} individual LEDs, {plan.physicalCount} StarPods,
        {' '}{plan.driverCount} TLC5947 driver and {plan.connectorGroupCount}
        {' '}12-channel connector groups. All other quantities come from the
        original saved candidate BOM; unknown lengths remain TO MEASURE.</p>
      <p>Source confidence describes the vendor; build validation describes what
        you have physically proven. Neither status is inferred from a link.</p>
      {groupInfo.map(([id,label])=><details className="rw-parts-group" key={id}
        open={id==='buy'}>
        <summary>{label} · {plan.parts.filter(p=>p.group===id).length} items</summary>
        <div>{plan.parts.filter(p=>p.group===id).map(p=><PartEditor key={p.key+'-'+(work?.parts[p.key]?.updatedAt||'new')}
          part={p} materials={materials} current={work?.parts[p.key]}
          busy={Boolean(busy)||!work}
          onSave={value=>save(value,'part-'+p.key)}/>)}</div>
      </details>)}
    </section>}
    {showChecklist&&<section className="rw-section rw-engineering">
      <h5>Electrical engineering HOLD · Pico W → TLC5947 → discrete stars</h5>
      <p><b>Do not use legacy WS2812 firmware</b> (including the old
        {' '}<code>firmware/pico2w/main.py</code> demonstration) as production
        firmware. The TLC5947 constant-current sink design requires the approved
        schematic, tested firmware, and one authoritative DIN / CLK / LAT pin map.
        No GPIO assignments are assumed here.</p>
      <p>With power disconnected and a reviewed schematic: LED anodes use the
        validated shared V+ rail; each LED cathode is assigned to the numbered
        TLC5947 sink channel OUT0…OUT(N−1), in EXACT frozen star-map order.
        Common ground, fuse, VSYS/USB backfeed protection and the correct
        controlled supply must be verified before first power-up. Never drive
        discrete stars from Pico 3V3 or the accent strip directly from a GPIO.
        This is a conceptual inspection guide, not approved connection instructions.</p>
      <p>First power-up needs a current-limited bench supply, channel walk,
        measured supply current, temperatures, burn-in and recorded abnormalities.
        Never choose final PSU/fuse sizing until those measurements exist.</p>
    </section>}
    {showChecklist&&<section className="rw-section">
      <h5>Build checklist · 14 phases · {work?.done??0}/{work?.total??0}</h5>
      <p>Each check is saved to private per-order storage, so you can stop,
        refresh, sign in again and resume this exact build. Checking a step
        is an owner statement — do not mark unperformed tests complete.</p>
      {phases.phases.map((phase,i)=>{
        const passed=phase.steps.filter(step=>work?.steps[step.id]?.checked).length
        return <details key={phase.id} className="rw-phase" open={i===0}>
          <summary><strong>{i+1}. {phase.label}</strong>
            <span>{passed}/{phase.steps.length}</span></summary>
          <div className="rw-phase-steps">{phase.steps.map(step=>
            <label key={step.id}><input type="checkbox"
              disabled={Boolean(busy)||!work}
              checked={work?.steps[step.id]?.checked===true}
              onChange={e=>void save({kind:'step',key:step.id,checked:e.target.checked},
                'step-'+step.id)}/>
              <span>{step.title}</span></label>)}</div>
        </details>
      })}
    </section>}
    {showChecklist&&<section className="rw-section">
      <h5>Electrical, optical, burn-in and QA test records</h5>
      <p>Record measurements, dates, inspected wiring, defects, and actual
        results. These entries are private to this exact test Design ID.</p>
      {evidenceGroups.map(group=><details className="rw-phase" key={group.title}>
        <summary><strong>{group.title}</strong>
          <span>{group.rows.filter(([key])=>work?.evidence[key]?.value).length}/{group.rows.length} recorded</span></summary>
        <div className="rw-evidence">
          {group.rows.map(([key,label])=><EvidenceEditor key={key+'-'+(work?.evidence[key]?.updatedAt||'new')} code={key}
            label={label} value={work?.evidence[key]?.value||''}
            onSave={value=>save(value,'evidence-'+key)}
            busy={Boolean(busy)||!work}/>)}
        </div>
      </details>)}
    </section>}
    {showChecklist&&<section className="rw-section">
      <h5>Private final QC photographs</h5>
      <p>Attach one or more real inspection photos for this specific test.
        They are stored in owner-only Vercel storage and are never attached
        to Etsy or exposed as public image URLs (JPEG/PNG/WebP, max 8 MB each).</p>
      <div className="rw-qc-upload">
        <label>QC photo<input type="file" accept="image/jpeg,image/png,image/webp"
          onChange={e=>setQcPhoto(e.target.files?.[0]||null)}/></label>
        <label>Inspection label<input value={qcLabel} maxLength={100}
          onChange={e=>setQcLabel(e.target.value)}/></label>
        <button type="button" disabled={!qcPhoto||Boolean(busy)}
          onClick={()=>void uploadQc()}>{busy==='qc-photo'?'Uploading…':'Upload private QC photo'}</button>
      </div>
      {(work?.photos||[]).map(p=><div key={p.photoId} className="rw-photo-row">
        <span>{p.name} · {new Date(p.uploadedAt).toLocaleString()}</span>
        <button type="button" disabled={Boolean(busy)}
          onClick={()=>void downloadQc(p.photoId,p.ext)}>↓ Open private QC photo</button>
      </div>)}
    </section>}
    {showChecklist&&<section className="rw-section rw-completion">
      <h5>Test build closeout</h5>
      <p><strong>{work?.readyToBuild?'Ready for owner-reviewed prototype assembly':
        'HOLD — not ready for test assembly'}</strong>. The button below can only
        record an internal completed rehearsal after all phase checks, required
        parts, print approval and specified electrical/QA records have been saved.</p>
      {work?.completionBlockers?.length?<details>
        <summary>Outstanding completion gates · {work.completionBlockers.length}</summary>
        <ul>{work.completionBlockers.map(s=><li key={s}>{s}</li>)}</ul>
      </details>:null}
      <button type="button" disabled={Boolean(busy)||!work||
        Boolean(work.completionBlockers.length)||Boolean(work.completedAt)}
        onClick={()=>void save({kind:'complete'},'complete')}>
        {work?.completedAt?'✓ TEST BUILD COMPLETE':'Mark TEST BUILD COMPLETE'}
      </button>
      {work?.completedAt&&<p className="rw-file-approved">
        Owner-reported test completed at {new Date(work.completedAt).toLocaleString()}.
        This is NOT an actual Etsy payment, certified electrical design, or shipping action.
      </p>}
    </section>}
  </section>
}
