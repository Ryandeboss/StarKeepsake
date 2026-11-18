import {useEffect,useMemo,useState} from 'react'
import {createCustomerPacket,downloadFile} from '../customerOrder'
import {PRINT_VARIANTS,trimSafeGuideSvg} from '../manufacturingPrint'
import type {PrintVariantId} from '../manufacturingPrint'
import type {LoadedDesign} from '../savedDesign'
import {buildManufacturingJobPlan} from '../manufacturingJobPlan'
import {OwnerManufacturingPlan} from './OwnerManufacturingPlan'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import './OwnerProductionFiles.css'

const BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
type Packet=Awaited<ReturnType<typeof createCustomerPacket>>

export function OwnerProductionFiles({adminKey,receiptId,transactionId,designId,materials}:{
  adminKey:string;receiptId:number;transactionId:number;designId:string;
  materials:MaterialSnapshot|null
}){
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [packet,setPacket]=useState<Packet|null>(null)
  const [savedMeta,setSavedMeta]=useState<LoadedDesign|null>(null)
  const [metaError,setMetaError]=useState('')
  const url=BASE+'/api/admin/production/jobs/'+receiptId+'/'+transactionId
  // The saved design metadata alone is enough to show the N-dependent BOM.
  // Original photo bytes are requested only when owner explicitly clicks Prepare.
  useEffect(()=>{
    if(!adminKey)return
    let active=true
    void (async()=>{
      try{
        const response=await fetch(url+'/design',{
          cache:'no-store',headers:{'X-Starkeepsake-Admin-Key':adminKey}})
        if(!response.ok)throw Error('A verified, paid and matched Etsy design could not be loaded.')
        const saved=await response.json() as LoadedDesign
        if(!active)return
        if(saved.designId!==designId)throw Error('Saved Design ID mismatches the paid Etsy item.')
        setSavedMeta(saved);setMetaError('')
      }catch(e){
        if(active)setMetaError(e instanceof Error?e.message:'Saved design unavailable.')
      }
    })()
    return ()=>{active=false}
  },[adminKey,url,designId])
  const plan=useMemo(()=>{
    if(!savedMeta)return null
    try{return buildManufacturingJobPlan(savedMeta.design,savedMeta.preferences)}
    catch{return null}
  },[savedMeta])
  async function get(path:string):Promise<Response>{
    const response=await fetch(url+path,{cache:'no-store',
      headers:{'X-Starkeepsake-Admin-Key':adminKey}})
    if(response.status===401)throw Error('Owner authorization expired; sign in again.')
    if(response.status===404)throw Error('A verified paid matched job or its files could not be found.')
    if(!response.ok)throw Error('Owner files temporarily unavailable (HTTP '+response.status+').')
    return response
  }
  async function prepare(){
    if(busy)return
    setBusy(true);setError('');setPacket(null)
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
      setPacket(await createCustomerPacket({
        design:saved.design,prefs:saved.preferences,photo,photoUrl:originalUrl,
        cutoutUrl,savedDesignId:saved.designId
      }))
    }catch(e){
      setError(e instanceof Error?e.message:'Could not create manufacturing files.')
    }finally{
      if(originalUrl)URL.revokeObjectURL(originalUrl)
      if(cutoutUrl)URL.revokeObjectURL(cutoutUrl)
      setBusy(false)
    }
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
  return <section className="opf-panel" aria-label="Private paid-order manufacturing files">
    <div className="opf-heading">
      <div><h4>Owner manufacturing files</h4>
        <p>Prepare three formats from this paid Etsy job’s securely saved design.</p></div>
      <button type="button" className="production-primary" onClick={()=>void prepare()}
        disabled={!adminKey||busy}>{busy?'Rendering print formats…':
          packet?'↻ Regenerate files':'Prepare production files'}</button>
    </div>
    {metaError&&<p role="alert" className="production-error">{metaError}</p>}
    {savedMeta&&!plan&&<p role="alert" className="production-error">
      Saved design manufacturing data is invalid; do not purchase parts.
    </p>}
    {plan&&<OwnerManufacturingPlan key={plan.designId} plan={plan}
      materials={materials} receiptId={receiptId} transactionId={transactionId}/>}
    {error&&<p role="alert" className="production-error">{error}</p>}
    {packet&&<div className="opf-results" role="status">
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
