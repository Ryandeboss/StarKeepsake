import {useEffect,useMemo,useRef,useState} from 'react'
import {createCustomerPacket,downloadFile} from '../customerOrder'
import {PRINT_VARIANTS,trimSafeGuideSvg} from '../manufacturingPrint'
import type {PrintVariantId} from '../manufacturingPrint'
import type {LoadedDesign} from '../savedDesign'
import {buildManufacturingJobPlan} from '../manufacturingJobPlan'
import {readFrozenMakerPacket} from '../frozenMakerReader'
import {OwnerManufacturingPlan} from './OwnerManufacturingPlan'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import './OwnerProductionFiles.css'

const BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
type Packet=Awaited<ReturnType<typeof createCustomerPacket>>

export function OwnerProductionFiles({adminKey,receiptId,transactionId,designId,materials,simulated=false}:{
  adminKey:string;receiptId:number;transactionId:number;designId:string;
  materials:MaterialSnapshot|null;simulated?:boolean
}){
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [packet,setPacket]=useState<Packet|null>(null)
  const [savedMeta,setSavedMeta]=useState<LoadedDesign|null>(null)
  const [metaError,setMetaError]=useState('')
  const [archived,setArchived]=useState<{archived:boolean;frozenAt:string|null;
    bytes:number|null}|null>(null)
  const [archiveBusy,setArchiveBusy]=useState(false)
  const [archiveError,setArchiveError]=useState('')
  const [photoPreview,setPhotoPreview]=useState('')
  const [proofPreview,setProofPreview]=useState('')
  const [frozenBusy,setFrozenBusy]=useState(simulated)
  const [frozenError,setFrozenError]=useState('')
  const [frozenLoaded,setFrozenLoaded]=useState<Awaited<ReturnType<typeof readFrozenMakerPacket>>|null>(null)
  const [frozenPreview,setFrozenPreview]=useState('')
  const proofObject=useRef('')
  const frozenObject=useRef('')
  const simulationUrl='/api/production/simulate?designId='+encodeURIComponent(designId)
  const archiveUrl=simulated?simulationUrl+'&view=archive':
    '/api/production/archive?receiptId='+receiptId+'&transactionId='+transactionId
  const url=simulated?simulationUrl:
    BASE+'/api/admin/production/jobs/'+receiptId+'/'+transactionId
  const designUrl=simulated?simulationUrl+'&view=design':url+'/design'
  const assetUrl=(type:'original'|'foreground')=>simulated?
    simulationUrl+'&view=asset&type='+type:url+'/assets/'+type
  // The saved design metadata alone is enough to show the N-dependent BOM.
  // Original photo bytes are requested only when owner explicitly clicks Prepare.
  useEffect(()=>{
    if(!adminKey)return
    let active=true
    void (async()=>{
      try{
        const response=await fetch(designUrl,{
          cache:'no-store',headers:{'X-Starkeepsake-Admin-Key':adminKey}})
        if(!response.ok)throw Error(simulated?'Test design is unavailable.':
          'A verified, paid and matched Etsy design could not be loaded.')
        const saved=await response.json() as LoadedDesign
        if(!active)return
        if(saved.designId!==designId)throw Error('Saved Design ID mismatches the paid Etsy item.')
        setSavedMeta(saved);setMetaError('')
        try{
          const check=await fetch(archiveUrl,{cache:'no-store',
            headers:{'X-Starkeepsake-Admin-Key':adminKey}})
          if(!active)return
          if(check.status===404)
            setArchived({archived:false,frozenAt:null,bytes:null})
          else if(check.ok){setArchived(await check.json());setArchiveError('')}
          else throw Error('Private archive lookup failed (HTTP '+check.status+').')
        }catch(error){
          if(active)setArchiveError(error instanceof Error?
            error.message:'Private archive lookup unavailable.')
        }
      }catch(e){
        if(active)setMetaError(e instanceof Error?e.message:'Saved design unavailable.')
      }
    })()
    return ()=>{active=false}
  },[adminKey,designUrl,designId,archiveUrl,simulated])
  const plan=useMemo(()=>{
    if(simulated)return frozenLoaded?.plan??null
    if(!savedMeta)return null
    try{return buildManufacturingJobPlan(savedMeta.design,savedMeta.preferences)}
    catch{return null}
  },[savedMeta,simulated,frozenLoaded])
  async function get(path:string):Promise<Response>{
    const location=path==='/design'?designUrl:
      path==='/assets/original'?assetUrl('original'):
      path==='/assets/foreground'?assetUrl('foreground'):url+path
    const response=await fetch(location,{cache:'no-store',
      headers:{'X-Starkeepsake-Admin-Key':adminKey}})
    if(response.status===401)throw Error('Owner authorization expired; sign in again.')
    if(response.status===404)throw Error(simulated?
      'The test order was deleted or its saved files are unavailable.':
      'A verified paid matched job or its files could not be found.')
    if(!response.ok)throw Error('Owner files temporarily unavailable (HTTP '+response.status+').')
    return response
  }
  async function prepare(){
    if(busy)return
    setBusy(true);setError('');setPacket(null)
    if(proofObject.current){URL.revokeObjectURL(proofObject.current);proofObject.current=''}
    setProofPreview('')
    let originalUrl='',cutoutUrl=''
    try{
      const saved=await(await get('/design')).json() as LoadedDesign
      if(saved.designId!==designId)throw Error('Etsy job and saved Design IDs do not match.')
      const original=await(await get('/assets/original')).blob()
      const mime=original.type.toLowerCase()
      if(!['image/jpeg','image/png','image/webp'].includes(mime))
        throw Error('Unsupported private original photograph format.')
      const photo=new File([original],mime==='image/png'?'original-photo.png':
        mime==='image/webp'?'original-photo.webp':'original-photo.jpg',{type:mime})
      originalUrl=URL.createObjectURL(original)
      if(saved.hasPreparedForeground)
        cutoutUrl=URL.createObjectURL(await(await get('/assets/foreground')).blob())
      const prepared=await createCustomerPacket({
        design:saved.design,prefs:saved.preferences,photo,photoUrl:originalUrl,
        cutoutUrl,savedDesignId:saved.designId
      })
      proofObject.current=URL.createObjectURL(prepared.sheet)
      setProofPreview(proofObject.current)
      setPacket(prepared)
    }catch(e){
      setError(e instanceof Error?e.message:'Could not create manufacturing files.')
    }finally{
      if(originalUrl)URL.revokeObjectURL(originalUrl)
      if(cutoutUrl)URL.revokeObjectURL(cutoutUrl)
      setBusy(false)
    }
  }
  async function downloadArchived(){
    if(archiveBusy)return
    setArchiveBusy(true);setArchiveError('')
    try{
      const result=await fetch(archiveUrl+'&download=1',{
        cache:'no-store',headers:{'X-Starkeepsake-Admin-Key':adminKey}})
      if(!result.ok)throw Error('Private archive download failed (HTTP '+
        result.status+').')
      downloadFile(await result.blob(),designId+'-frozen-maker-packet.zip')
    }catch(error){setArchiveError(error instanceof Error?
      error.message:'Frozen packet could not be downloaded.')}
    finally{setArchiveBusy(false)}
  }
  // Owner-only original and actual generated order proof, never generic demo data.
  useEffect(()=>{
    if(!simulated||!adminKey)return
    let active=true,objectUrl=''
    void (async()=>{
      try{
        const result=await fetch(simulationUrl+'&view=asset&type=original',{
          cache:'no-store',headers:{'X-Starkeepsake-Admin-Key':adminKey}})
        if(!result.ok)return
        objectUrl=URL.createObjectURL(await result.blob())
        if(active)setPhotoPreview(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      }catch{/* The private maker files remain available via the owner controls. */}
    })()
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}
  },[simulated,adminKey,simulationUrl])
  useEffect(()=>()=>{if(proofObject.current)URL.revokeObjectURL(proofObject.current)},[])
  useEffect(()=>{
    if(!simulated||!adminKey)return
    let active=true,previewUrl=''
    void (async()=>{
      try{
        const response=await fetch(archiveUrl+'&download=1',{
          cache:'no-store',headers:{'X-Starkeepsake-Admin-Key':adminKey}})
        if(!response.ok)throw Error('Frozen test packet unavailable (HTTP '+response.status+').')
        const parsed=await readFrozenMakerPacket(await response.blob(),designId)
        previewUrl=URL.createObjectURL(parsed.preview)
        if(!active){URL.revokeObjectURL(previewUrl);return}
        frozenObject.current=previewUrl
        setFrozenPreview(previewUrl);setFrozenLoaded(parsed)
      }catch(e){
        if(active)setFrozenError(e instanceof Error?e.message:'Could not read original maker ZIP.')
      }finally{if(active)setFrozenBusy(false)}
    })()
    return()=>{active=false;if(previewUrl)URL.revokeObjectURL(previewUrl)
      if(frozenObject.current===previewUrl)frozenObject.current=''}
  },[simulated,adminKey,archiveUrl,designId])
  function downloadFrozen(name:string){
    const file=frozenLoaded?.files[name]
    if(!file)return
    downloadFile(file,designId+'-'+name)
  }
  const specs=packet?.manifest.manufacturing?.printVariants
  function downloadSupplement(id:PrintVariantId,kind:'spec'|'guide'){
    const variant=PRINT_VARIANTS.find(v=>v.id===id)
    const spec=specs?.find(s=>s.id===id)?.spec
    if(!variant||!spec)return
    const body=kind==='spec'?JSON.stringify(spec,null,2):trimSafeGuideSvg(spec)
    downloadFile(new Blob([body],{type:kind==='spec'?'application/json':'image/svg+xml'}),
      designId+'-'+(kind==='spec'?variant.spec:variant.guide))
  }
  return <section className="opf-panel" aria-label={simulated?
    'Private simulated-order manufacturing files':'Private paid-order manufacturing files'}>
    {simulated&&<div className="opf-test-banner" role="note">
      <strong>TEST WORK ORDER · NO ETSY PAYMENT</strong>
      <span>This is your exact saved design. Test checklist progress is separate
        from genuine orders. All physical, stock and safety holds still apply.</span>
    </div>}
    {simulated&&frozenBusy&&<div className="opf-archive-warning" role="status">
      Loading the original frozen work order, print masters and exact N-star plan…
    </div>}
    {simulated&&frozenError&&<p className="production-error" role="alert">
      Frozen packet could not be verified: {frozenError}.
      Hold this build; do not replace the snapshot with regenerated files.</p>}
    {simulated&&frozenLoaded&&<div className="opf-frozen-master">
      <div className="opf-frozen-heading">
        <span>FILES FOR THIS BUILD · ORIGINAL SNAPSHOT</span>
        <strong>{designId} · {frozenLoaded.plan.version}</strong>
        <small>Every download below comes directly from the immutable ZIP made
          when this design was saved. Later application changes cannot alter these files.</small>
      </div>
      <div className="opf-frozen-preview">
        <img src={frozenPreview} alt="Original frozen final customer preview with the selected sky and photo"/>
        <div>
          <h4>Final customer preview</h4>
          <p>Compare this original checkout preview with the physical frame.
            It is NOT the 300 DPI print master.</p>
          <button type="button" onClick={()=>downloadFrozen('order-sheet.png')}>
            ↓ Final customer preview</button>
          <button type="button" onClick={()=>downloadFrozen('order.json')}>
            ↓ Frozen order manifest</button>
          <button type="button" onClick={()=>downloadFrozen('manufacturing-job-plan.json')}>
            ↓ Frozen manufacturing plan</button>
          <button type="button" onClick={()=>downloadFrozen('physical-star-map.csv')}>
            ↓ Exact frozen star CSV</button>
          {frozenLoaded.files['drill-template-1to1-DRAFT.svg']&&
            <button type="button" onClick={()=>downloadFrozen('drill-template-1to1-DRAFT.svg')}>
              ↓ Draft 1:1 drill SVG (CALIBRATION REQUIRED)</button>}
        </div>
      </div>
      <div className="opf-frozen-files">
        {PRINT_VARIANTS.map(variant=>{
          const spec=frozenLoaded.manifest.manufacturing?.printVariants?.find(v=>v.id===variant.id)?.spec
          return <article key={variant.id}>
            <strong>{variant.label}</strong>
            <small>{spec?.documentSizeIn.width} × {spec?.documentSizeIn.height} in ·
              {spec?.documentPixels.width} × {spec?.documentPixels.height} px ·
              {spec?.dpi} DPI · {spec?.colorSpace}</small>
            <small>Bleed {spec?.bleedIn} in · safe inset {spec?.safeInsetIn} in ·
              {spec?.reviewStatus} — supplier acceptance required</small>
            <button type="button" onClick={()=>downloadFrozen(variant.artwork)}>
              ↓ Exact frozen {variant.artwork}</button>
            <button type="button" onClick={()=>downloadFrozen(variant.spec)}>
              ↓ Print spec JSON</button>
            <button type="button" onClick={()=>downloadFrozen(variant.guide)}>
              ↓ Trim/safe PROOF guide (never over customer artwork)</button>
          </article>
        })}</div>
      <details><summary>Original images and build-source references</summary>
        <div className="opf-frozen-controls">
          {Object.keys(frozenLoaded.files).filter(name=>
            name.startsWith('original-photo.')||name==='prepared-foreground.png'||
            name==='photo-quality-report.json'||name==='candidate-parts.csv'||
            name==='assembly-checklist.json').map(name=>
            <button key={name} type="button" onClick={()=>downloadFrozen(name)}>
              ↓ {name}</button>)}
        </div>
      </details>
    </div>}
    {simulated&&photoPreview&&<div className="opf-test-photo">
      <img src={photoPreview} alt="Original photograph uploaded for the exact saved test design"/>
      <div><strong>Original customer photograph</strong>
        <p>The real saved photo, not a demo image.
          Generate the print proof below to see the combined star map.</p></div>
    </div>}
    <div className="opf-heading">
      <div><h4>{simulated?'Your saved design — manufacturing files':'Owner manufacturing files'}</h4>
        <p>{simulated?'Download the exact ZIP prepared in Chapter 05 or generate printable artwork here without reopening the customer builder.':
          'Download the exact checkout ZIP frozen before Etsy payment. New print regenerations are only reference copies and may change with later code.'}</p></div>
      <button type="button" className="production-primary" onClick={()=>void prepare()}
        disabled={!adminKey||busy}>{busy?'Rendering print formats…':
          packet?'↻ Regenerate reference files':'Generate reference files (not frozen)'}</button>
    </div>
    {archived?.archived&&<div className="opf-archive-confirm" role="status">
      <strong>✓ {simulated?'Original test design ZIP':'Original checkout maker ZIP'} preserved in private Vercel storage</strong>
      <small>{archived.frozenAt?'Frozen '+new Date(archived.frozenAt).toLocaleString():
        'Frozen time not available'} · {archived.bytes?
          Math.round(archived.bytes/1024/1024)+' MB':'Size not available'}</small>
      <button type="button" onClick={()=>void downloadArchived()} disabled={archiveBusy}>
        {archiveBusy?'Downloading frozen ZIP…':'↓ Download original frozen maker ZIP'}
      </button>
    </div>}
    {archived?.archived===false&&<p className="opf-archive-warning" role="status">
      No frozen checkout packet exists for this order (possibly saved before this release).
      Regenerated files below are not an immutable customer-checkout copy.
    </p>}
    {archiveError&&<p role="alert" className="production-error">{archiveError}</p>}
    {metaError&&<p role="alert" className="production-error">{metaError}</p>}
    {savedMeta&&!plan&&<p role="alert" className="production-error">
      Saved design manufacturing data is invalid; do not purchase parts.
    </p>}
    {plan&&<OwnerManufacturingPlan key={plan.designId} plan={plan}
      materials={materials} receiptId={receiptId} transactionId={transactionId}
      adminKey={adminKey} simulated={simulated}/>}


    {error&&<p role="alert" className="production-error">{error}</p>}
    {packet&&<div className="opf-results" role="status">
      {proofPreview&&<div className="opf-test-photo opf-print-proof">
        <img src={proofPreview} alt="Generated proof of the exact saved sky and photograph"/>
        <div><strong>Your saved photograph with its calculated sky</strong>
          <p>Review the composition here, then approve the chosen print-lab
            variant against a physical proof.</p></div>
      </div>}
      <p><strong>Owner print files generated.</strong> Each retains the identical
        11 × 14-inch visible composition. Review the photograph and physical proof before printing.</p>
      {packet.manifest.manufacturing?.photoQuality&&
        <div className={'opf-quality opf-quality-'+packet.manifest.manufacturing.photoQuality.status}
          role="status">
          <strong>{packet.manifest.manufacturing.photoQuality.needsOwnerReview
            ?'PRINT HOLD — owner review required':'Source photo print preflight'}</strong>
          <p>Effective source resolution: <b>
            {packet.manifest.manufacturing.photoQuality.effectivePpi} PPI</b>;
            {' '}printed photograph approximately
            {' '}{packet.manifest.manufacturing.photoQuality.printedPhotoIn.width} ×
            {' '}{packet.manifest.manufacturing.photoQuality.printedPhotoIn.height} inches.
            {packet.manifest.manufacturing.photoQuality.needsOwnerReview
              ?' Do NOT send to printer until the source, crop and physical proof are approved.'
              :' Human sharpness and printed proof checks remain required.'}</p>
          {packet.manifest.manufacturing.photoQuality.warnings.map((message,i)=>
            <p key={i}>• {message}</p>)}
        </div>}
      <button type="button" onClick={()=>downloadFile(packet.zip,
        designId+'-owner-manufacturing.zip')}>↓ Complete maker packet (ZIP)</button>
      <div className="opf-variants">{PRINT_VARIANTS.map(variant=><article key={variant.id}>
        <strong>{variant.label}</strong>
        <small>{specs?.find(x=>x.id===variant.id)?.spec.documentSizeIn.width} ×
          {' '}{specs?.find(x=>x.id===variant.id)?.spec.documentSizeIn.height} inches · 300 DPI</small>
        <button type="button" onClick={()=>downloadFile(packet.printVariants[variant.id],
          designId+'-'+variant.artwork)}>↓ Print PNG</button>
        <button type="button" onClick={()=>downloadSupplement(variant.id,'spec')}>
          ↓ Print specs</button>
        <button type="button" onClick={()=>downloadSupplement(variant.id,'guide')}>
          ↓ Trim proof</button>
      </article>)}</div>
      <small>ZIP includes the original customer photo, any polished foreground,
        illustrative order sheet and saved design manifest. The printer must approve
        chosen bleed dimensions. Actual photo quality and star/hole alignment still require
        a physical proof. No supplier order or manufacturing step is triggered.</small>
    </div>}
  </section>
}
