import {useEffect,useMemo,useState} from 'react'
import {readFrozenMakerPacket} from '../frozenMakerReader'
import {PRINT_VARIANTS} from '../manufacturingPrint'
import {MAKER_STEPS,type MakerPart} from '../manufacturingJobPlan'
import {supplierCandidateFor,supplierSkuFor,resolveSupplierLink,SUPPLIER_COMPONENTS,assemblyQuantity} from '../supplierCandidates'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import rehearsal from '../rehearsalPhases.json'
import {downloadFile} from '../customerOrder'
import './SimpleStudioModules.css'

type Module='parts'|'checklist'|'files'
type PartStatus={status:string;validation:string;notes:string}
type SimplePart=Pick<MakerPart,'key'|'name'|'quantity'|'unit'|'group'|'skuHint'|'required'>
type Frozen=Awaited<ReturnType<typeof readFrozenMakerPacket>>
type Step={id:string;title:string}
type Phase={id:string;label:string;steps:Step[]}
type Work={steps:Record<string,{checked:boolean}>;parts:Record<string,PartStatus>}
const paidPhases:Phase[]=[
  {id:'prepare',label:'Prepare',steps:MAKER_STEPS.slice(0,6).map(({id,title})=>({id,title}))},
  {id:'build',label:'Assemble',steps:MAKER_STEPS.slice(6,14).map(({id,title})=>({id,title}))},
  {id:'test',label:'Test',steps:MAKER_STEPS.slice(14,19).map(({id,title})=>({id,title}))},
  {id:'finish',label:'Finish',steps:MAKER_STEPS.slice(19).map(({id,title})=>({id,title}))},
]
const testPhases:Phase[]=rehearsal.phases.map(p=>({
  id:p.id,label:p.label,steps:p.steps.map(s=>({id:s.id,title:s.title}))
}))
function asError(e:unknown){return e instanceof Error?e.message:'Could not load this order.'}
async function json<T>(url:string,key:string,post?:unknown):Promise<T>{
  const response=await fetch(url,{method:post===undefined?'GET':'POST',cache:'no-store',
    headers:{'X-Starkeepsake-Admin-Key':key,
      ...(post===undefined?{}:{'Content-Type':'application/json'})},
    body:post===undefined?undefined:JSON.stringify(post)})
  if(!response.ok){
    const message=await response.json().catch(()=>null) as {error?:string}|null
    throw Error(message?.error||'Saving to the private order failed (HTTP '+response.status+').')
  }
  return await response.json() as T
}
function linkFor(part:SimplePart,materials:MaterialSnapshot|null){
  return resolveSupplierLink(supplierSkuFor(part.key,part.skuHint),supplierCandidateFor(part.key),materials?.parts)
}
const count=(quantity:number|null,unit:string)=>quantity===null?'Measure':
  quantity.toLocaleString('en-US',{maximumFractionDigits:2})+
    (unit==='each'?'×':' '+unit)
const root=(id:string)=>'/api/production/simulate?designId='+encodeURIComponent(id)
const paid=(receiptId:number,transactionId:number)=>
  '?receiptId='+encodeURIComponent(receiptId)+
  '&transactionId='+encodeURIComponent(transactionId)

export function SimpleStudioModule({module,adminKey,designId,simulated,
  receiptId,transactionId,materials}:{
  module:Module;adminKey:string;designId:string;simulated:boolean;
  receiptId:number;transactionId:number;materials:MaterialSnapshot|null
}){
  const [pending,setPending]=useState('')
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  const [parts,setParts]=useState<SimplePart[]>([])
  const [savedParts,setSavedParts]=useState<Record<string,PartStatus>>({})
  const [marked,setMarked]=useState<Record<string,boolean>>({})
  const [activePhase,setActivePhase]=useState(0)
  const [zip,setZip]=useState<Blob|null>(null)
  const [frozen,setFrozen]=useState<Frozen|null>(null)
  const [preview,setPreview]=useState('')
  const partEndpoint=simulated?root(designId)+'&view=parts':
    '/api/production/parts'+paid(receiptId,transactionId)
  const progressEndpoint=simulated?root(designId)+'&view=work':
    '/api/production/checklist'+paid(receiptId,transactionId)
  const archiveEndpoint=simulated?root(designId)+'&view=archive&download=1':
    '/api/production/archive'+paid(receiptId,transactionId)+'&download=1'
  const needsZip=module==='files'||(module==='parts'&&!simulated)
  useEffect(()=>{
    // The parent keys each modal by Design ID and view. Initial state is
    // already empty; let asynchronous results update it once available.
    let active=true,previewUrl=''
    void (async()=>{
      try{
        if(needsZip){
          const response=await fetch(archiveEndpoint,{cache:'no-store',
            headers:{'X-Starkeepsake-Admin-Key':adminKey}})
          if(!response.ok)throw Error('Original order files unavailable (HTTP '+response.status+').')
          const original=await response.blob()
          if(!active)return
          setZip(original)
          const parsed=await readFrozenMakerPacket(original,designId)
          if(!active)return
          setFrozen(parsed)
          if(module==='files'){
            previewUrl=URL.createObjectURL(parsed.preview)
            setPreview(previewUrl)
          }
          if(module==='parts')setParts(parsed.plan.parts)
        }
        if(module==='parts'){
          if(simulated){
            const data=await json<{parts:SimplePart[];saved:Record<string,PartStatus>}>(
              partEndpoint,adminKey)
            if(active){setParts(data.parts);setSavedParts(data.saved||{})
              setMarked(Object.fromEntries(data.parts.map(p=>[
                p.key,data.saved?.[p.key]?.status==='ready'])))}
          }else{
            const data=await json<{checked:Record<string,boolean>}>(
              partEndpoint,adminKey)
            if(active)setMarked(data.checked||{})
          }
        }else if(module==='checklist'){
          if(simulated){
            const data=await json<Work>(progressEndpoint,adminKey)
            if(active)setMarked(Object.fromEntries(Object.entries(data.steps||{})
              .map(([id,value])=>[id,value.checked===true])))
          }else{
            const data=await json<{progress:Record<string,{checked:boolean}>}>(
              progressEndpoint,adminKey)
            if(active)setMarked(Object.fromEntries(Object.entries(data.progress||{})
              .map(([id,value])=>[id,value.checked===true])))
          }
        }
      }catch(e){if(active)setError(asError(e))}
      finally{if(active)setLoaded(true)}
    })()
    return()=>{
      active=false
      if(previewUrl)URL.revokeObjectURL(previewUrl)
    }
  },[adminKey,archiveEndpoint,designId,module,needsZip,partEndpoint,progressEndpoint,simulated])
  const relevant=useMemo(()=>parts.filter(p=>p.group!=='make'),[parts])
  const checkedParts=relevant.filter(p=>marked[p.key]).length
  const starCount=parts.find(p=>p.key==='star_led')?.quantity??null
  const phases=simulated?testPhases:paidPhases
  const steps=phases.flatMap(p=>p.steps)
  const done=steps.filter(s=>marked[s.id]).length
  const current=phases[activePhase]||phases[0]
  async function toggle(id:string,checked:boolean){
    if(pending)return
    setPending(id);setError('')
    try{
      if(module==='parts'){
        if(simulated){
          const previous=savedParts[id]
          await json(partEndpoint.replace('view=parts','view=work'),adminKey,{
            kind:'part',key:id,status:checked?'ready':'needed',
            validation:previous?.validation||'research_candidate',
            notes:previous?.notes||''
          })
          setSavedParts(prev=>({...prev,[id]:{
            status:checked?'ready':'needed',
            validation:prev[id]?.validation||'research_candidate',
            notes:prev[id]?.notes||''
          }}))
        }else await json(partEndpoint,adminKey,{key:id,checked})
      }else if(simulated)await json(progressEndpoint,adminKey,{
        kind:'step',key:id,checked
      })
      else await json(progressEndpoint,adminKey,{stepId:id,checked})
      setMarked(prev=>({...prev,[id]:checked}))
    }catch(e){setError(asError(e))}
    finally{setPending('')}
  }
  function saveFile(name:string,blob:Blob){
    downloadFile(blob,designId+'-'+name)
  }
  const fileRows:{name:string;file:string}[]=frozen?[
    {name:'Final design preview',file:'order-sheet.png'},
    {name:'Star positions',file:'physical-star-map.csv'},
    ...PRINT_VARIANTS.map((v,index)=>({
      name:index===0?'Photo print · 11 × 14':
        index===1?'Photo print · ⅛-inch bleed':'Photo print · ¼-inch bleed',
      file:v.artwork
    })),
    {name:'Drilling guide · draft',file:'drill-template-1to1-DRAFT.svg'},
    {name:'Manufacturing plan',file:'manufacturing-job-plan.json'},
    ...Object.keys(frozen.files).filter(n=>n.startsWith('original-photo.'))
      .map(n=>({name:'Original photograph',file:n})),
  ].filter(f=>Boolean(frozen.files[f.file])):[]
  const extras=frozen?Object.keys(frozen.files).filter(n=>
    !fileRows.some(x=>x.file===n)):[]
  return <div className="simple-module">
    {!loaded&&<div className="simple-loading" role="status">
      <span className="simple-spinner"/> Loading…
    </div>}
    {error&&<div className="simple-error" role="alert">{error}</div>}
    {loaded&&module==='parts'&&<>
      <div className="simple-progress">
        <strong>{checkedParts} of {relevant.length} ready</strong>
        <progress value={checkedParts} max={relevant.length||1}/>
      </div>
      {relevant.length?<div className="simple-todo-list">
        {relevant.map(part=><div key={part.key}
          className={'simple-todo-row'+(marked[part.key]?' is-checked':'')}>
          <label><input type="checkbox" checked={marked[part.key]===true}
            disabled={!loaded||Boolean(error)||Boolean(pending)}
            onChange={e=>void toggle(part.key,e.target.checked)}/>
            <span className="simple-todo-name">
              {count(part.quantity,part.unit)} {part.name}
            </span>
          </label>
          {part.key==='print_pickup'?<span className="simple-expense">Expense</span>:
            SUPPLIER_COMPONENTS.some(c=>c.key===part.key)?<details className="simple-supplier-details">
              <summary>Suppliers</summary>
              <div className="simple-supplier-items">
                {part.key==='shipping'&&linkFor(part,materials)&&<a href={linkFor(part,materials)!} target="_blank" rel="noopener noreferrer">1 × Carton ↗</a>}
                {part.key==='mounting_hardware'&&linkFor(part,materials)&&<a href={linkFor(part,materials)!} target="_blank" rel="noopener noreferrer">Measure · M2.5 kit ↗</a>}
                {SUPPLIER_COMPONENTS.filter(c=>c.key===part.key).map(component=>{
                  const quantity=assemblyQuantity(component.quantityRule,part.quantity,starCount)
                  const link=resolveSupplierLink(component.sku,component,materials?.parts)
                  return <div key={component.sku}>{link?<a href={link} target="_blank" rel="noopener noreferrer">
                    {component.quantityRule==='alternative'?'Alternative':quantity===null?'Measure':quantity+' ×'} {component.product} ↗</a>:component.product}
                    <small>{component.notes}</small></div>
                })}
                {part.key==='harness_groups'&&linkFor(part,materials)&&<a href={linkFor(part,materials)!} target="_blank" rel="noopener noreferrer">Alternative: preassembled harness ↗</a>}
                <small>Research candidates only — validate compatibility before purchase.</small>
              </div>
            </details>:linkFor(part,materials)?<a target="_blank" rel="noopener noreferrer"
              title="Research candidate: verify price, stock and compatibility"
              href={linkFor(part,materials)!}>Supplier ↗</a>:
              <span className="simple-missing-link">Selection pending</span>}
          {part.key!=='print_pickup'&&supplierCandidateFor(part.key)&&
            <details className="simple-part-notes"><summary>Details</summary>
              <div className="simple-part-note-text">{materials?.parts.find(p=>p.sku.toUpperCase()===supplierSkuFor(part.key,part.skuHint)?.toUpperCase())?.notes||supplierCandidateFor(part.key)?.notes}</div>
              <small>Research candidate · physical validation required</small>
            </details>}
        </div>)}
      </div>:<div className="simple-empty">No components found.</div>}
    </>}
    {loaded&&module==='checklist'&&<>
      <div className="simple-progress">
        <strong>{done} of {steps.length} complete</strong>
        <progress value={done} max={steps.length||1}/>
      </div>
      <nav className="simple-phase-controls" aria-label="Checklist phases">
        <button type="button" disabled={activePhase===0}
          onClick={()=>setActivePhase(i=>Math.max(0,i-1))}>← Previous</button>
        <select aria-label="Choose a build phase" value={activePhase}
          onChange={e=>setActivePhase(Number(e.target.value))}>
          {phases.map((phase,i)=><option key={phase.id} value={i}>
            {i+1}. {phase.label}</option>)}
        </select>
        <button type="button" disabled={activePhase===phases.length-1}
          onClick={()=>setActivePhase(i=>Math.min(phases.length-1,i+1))}>
          Next →</button>
      </nav>
      <h3 className="simple-phase-title">{current.label}</h3>
      <div className="simple-todo-list">
        {current.steps.map(step=><label key={step.id}
          className={'simple-todo-row simple-step'+(marked[step.id]?' is-checked':'')}>
          <input type="checkbox" checked={marked[step.id]===true}
            disabled={!loaded||Boolean(error)||Boolean(pending)}
            onChange={e=>void toggle(step.id,e.target.checked)}/>
          <span className="simple-todo-name">{step.title}</span>
        </label>)}
      </div>
    </>}
    {module==='files'&&zip&&<button type="button"
      className="simple-zip-button" onClick={()=>saveFile('original-maker.zip',zip)}>
      Download complete ZIP ↓
    </button>}
    {module==='files'&&frozen&&<>
      {preview&&<img className="simple-art-preview" src={preview}
        alt="Exact saved customer photograph and star-map preview"/>}
      <div className="simple-file-list">
        {fileRows.map(file=><button key={file.file} type="button"
          onClick={()=>saveFile(file.file,frozen.files[file.file])}>
          <span>{file.name}</span><span aria-hidden="true">↓</span>
        </button>)}
      </div>
      {!!extras.length&&<details className="simple-extra-files">
        <summary>Other files ({extras.length})</summary>
        <div className="simple-file-list">{extras.map(name=>
          <button type="button" key={name}
            onClick={()=>saveFile(name,frozen.files[name])}>
            <span>{name}</span><span aria-hidden="true">↓</span>
          </button>)}</div>
      </details>}
    </>}
    {loaded&&module==='files'&&!zip&&<div className="simple-empty">
      No frozen files available.
    </div>}
  </div>
}
