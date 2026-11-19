import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { generateAstronomy, resolveMoment, searchLocations } from '../api'
import type { LocationCandidate } from '../api'
import { SkyMaskEditor } from '../components/SkyMaskEditor'
import { SkyWorkshopPreview, SkyWorkshopOrientation } from '../components/SkyWorkshopPreview'
import { HomeShowroom } from '../components/HomeShowroom'
import { ROOM_OPTIONS, WOOD_OPTIONS } from '../components/HomeShowroomOptions'
import type { RoomScene } from '../components/HomeShowroomOptions'
import { detectWorkshopSky } from '../skyBlend'
import { recommendedSkyPlacement } from '../skyPlacement'
import { chapterDestination } from '../workshopNavigation'
import { clearLocalWorkshopDraft, readLocalWorkshopDraft, resumedDraftStage, writeLocalWorkshopDraft } from '../localWorkshopDraft'
import type { LocalWorkshopDraft } from '../localWorkshopDraft'
import type { ChapterIndex } from '../workshopNavigation'
import type { WorkshopDetection } from '../skyBlend'
import { FULL_PHOTO_CROP } from '../photoCrop'
import { INITIAL_DESIGN_SPEC, getFrameLayout, toRect } from '../designSpec'
import type { DesignSpec } from '../designSpec'
import { isOfflineCity, searchOfflineCities } from '../offlineCitySearch'
import { isSampleLocation,resolveSampleMoment,SAMPLE_LOCATIONS } from '../sampleLocationFallback'
import { createTrialPhoto,TRIAL_DATE,TRIAL_TIME } from '../trialOrderFixture'
import { suggestedObserverHeading } from '../skyImmersiveData'
import { wrapWorkshopHeading, clampWorkshopPitch } from '../skyWorkshopMath'
import { skyAboveArtworkAspect } from '../frameSkyBalance'
import { makePhysicalView } from '../physicalStarView'
import { maskWorkingDimensions } from '../skyMaskMath'
import { physicalToggleError } from '../physicalStarSelection'
import type { AbovePhotoFitMode } from '../frameSkyBalance'
import { createCustomerPacket, downloadFile } from '../customerOrder'
import {freezeManufacturingPacket} from '../frozenPacket'
import type { OrderPreferences } from '../customerOrder'
import { designSnapshotSignature, parseDesignLink, privateDesignLink, reopenCustomerDesign, saveCustomerDesign } from '../savedDesign'
import type { SavedDesignReceipt } from '../savedDesign'
import { PREVIEW_FRAME_QUOTES, frameQuoteFor, loadFramePrices, moneyUsd } from '../storefrontPricing'
import { etsyListingForFinish, canContinueToEtsy } from '../etsyCheckout'
import type { FrameQuote } from '../storefrontPricing'
import './ExperiencePage.css'

type Stage = 'welcome'|'detecting'|'choice'|'refine'|'moment'|'calculating'|'preview'|'home'

// Reopening a saved within-photo design must retain its cutout's true open sky,
// otherwise invisible foreground stars could be mistakenly offered as LEDs.
async function restoreCutoutAlpha(blob:Blob,width:number,height:number){
  const bitmap=await createImageBitmap(blob)
  try{
    const dims=maskWorkingDimensions(width,height)
    const canvas=document.createElement('canvas')
    canvas.width=dims.width;canvas.height=dims.height
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    if(!ctx)throw new Error('Could not inspect the saved sky cutout.')
    ctx.clearRect(0,0,dims.width,dims.height)
    ctx.drawImage(bitmap,0,0,dims.width,dims.height)
    const rgba=ctx.getImageData(0,0,dims.width,dims.height).data
    const alpha=new Uint8ClampedArray(dims.width*dims.height)
    for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3]
    return alpha
  }finally{bitmap.close()}
}
type Placement = 'above'|'within'
const MAX_PHOTO = 10*1024*1024
const STEPS = [
  {label:'THE PHOTOGRAPH',key:'welcome'},
  {label:'THE HORIZON',key:'choice'},
  {label:'THE MOMENT',key:'moment'},
  {label:'YOUR SKY',key:'preview'},
  {label:'YOUR KEEPSAKE',key:'home'},
] as const
const photoFits: readonly {id:AbovePhotoFitMode;label:string}[]=[
  {id:'fit',label:'Whole photo'},
  {id:'center-crop',label:'Fill frame'},
  {id:'top-crop',label:'Favor lower edge'},
  {id:'bottom-crop',label:'Favor upper edge'},
]
const introWords = {
  detecting:['Preparing your photograph','Finding its open sky','Tracing the horizon','Finishing your preview'],
  calculating:['Finding your place','Reconstructing that night','Positioning real stars','Opening your observatory'],
}
function WizardLoader({kind,progress}: {kind:'detecting'|'calculating';progress:number}) {
  const labels=introWords[kind]
  const index=Math.min(3,Math.floor(progress/24))
  return <div className="at-loader" role="status" aria-live="polite">
    <div className="at-loading-sky" aria-hidden="true">
      <span className="at-loading-core">✦</span>
      <span className="at-shooting-star"/><span className="at-shooting-star"/>
      <span className="at-shooting-star"/><span className="at-shooting-star"/>
      <span className="at-shooting-star"/><span className="at-shooting-star"/>
      <span className="at-loading-sky-spark">✧</span>
    </div>
    <span className="at-kicker">STARKEEP SAKE / THE NIGHT ATELIER</span>
    <h2>{kind==='detecting' ? 'Finding the sky in your story.' : 'Returning to your night.'}</h2>
    <p>{labels[index]}…</p>
    <div className="at-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(progress)} aria-label="Illustrative loading progress">
      <span style={{width:`${progress}%`}}/>
    </div>
    <small>{kind==='detecting'
      ? 'The AI model runs in your browser. Your original photograph stays here.'
      : 'Calculating stars using your chosen location and local time.'}</small>
  </div>
}

export function ExperiencePage() {
  const [stage,setStage]=useState<Stage>('welcome')
  const physicalInspector=new URLSearchParams(window.location.search).get('physicalInspector')==='1'
  const trialPhotoMode=new URLSearchParams(window.location.search).get('trial')==='1'
  const trialSampleStarted=useRef(false)
  const [physicalOnly,setPhysicalOnly]=useState(true)
  const [customizingLights,setCustomizingLights]=useState(false)
  const [physicalMessage,setPhysicalMessage]=useState('')
  // Incrementing this id replays the confirmation animation even if the
  // customer clicks restore twice without changing their selection.
  const [physicalRestoreId,setPhysicalRestoreId]=useState(0)
  const [design,setDesign]=useState<DesignSpec>(()=>({...INITIAL_DESIGN_SPEC,stars:[],astronomy:null}))
  const [photo,setPhoto]=useState<File|null>(null)
  const [photoUrl,setPhotoUrl]=useState('')
  const [dimensions,setDimensions]=useState<{width:number;height:number}|null>(null)
  const [detected,setDetected]=useState<WorkshopDetection|null>(null)
  const [overlayUrl,setOverlayUrl]=useState('')
  const [detectorError,setDetectorError]=useState('')
  const [showMask,setShowMask]=useState(true)
  const [progress,setProgress]=useState(5)
  const [placement,setPlacement]=useState<Placement>('within')
  const [cutoutUrl,setCutoutUrl]=useState('')
  const [savedAlpha,setSavedAlpha]=useState<Uint8ClampedArray|null>(null)
  const [showPolishGuide,setShowPolishGuide]=useState(true)
  const [showPerspectiveGuide,setShowPerspectiveGuide]=useState(true)
  const [date,setDate]=useState('')
  const [time,setTime]=useState('21:00')
  const [unknownTime,setUnknownTime]=useState(false)
  const [query,setQuery]=useState('')
  const [candidates,setCandidates]=useState<LocationCandidate[]>([])
  const [selected,setSelected]=useState<LocationCandidate|null>(null)
  const [offline,setOffline]=useState(false)
  const [isSearching,setIsSearching]=useState(false)
  const [heading,setHeading]=useState(180)
  const [pitch,setPitch]=useState(18)
  const [fov,setFov]=useState(105)
  const [skyPercent,setSkyPercent]=useState(38)
  const [photoFit,setPhotoFit]=useState<AbovePhotoFitMode>('fit')
  const [atmosphericGlow,setAtmosphericGlow]=useState(true)
  const [skyTone,setSkyTone]=useState<'natural'|'indigo'|'teal'>('natural')
  const [lightsOn,setLightsOn]=useState(true)
  const [finish,setFinish]=useState<'walnut'|'oak'|'ebony'>('walnut')
  const [frameQuotes,setFrameQuotes]=useState<FrameQuote[]>([...PREVIEW_FRAME_QUOTES])
  const [priceNotice,setPriceNotice]=useState('')
  const [pricesLoading,setPricesLoading]=useState(false)
  const [room,setRoom]=useState<RoomScene>('warm')
  const [inscription,setInscription]=useState('')
  const [orderBusy,setOrderBusy]=useState(false)
  const [orderError,setOrderError]=useState('')
  const [saveBusy,setSaveBusy]=useState(false)
  const [saveError,setSaveError]=useState('')
  const [copied,setCopied]=useState<'link'|'order'|'details'|null>(null)
  const copiedTimeout=useRef<number|null>(null)
  const [restoreBusy,setRestoreBusy]=useState(()=>Boolean(parseDesignLink(window.location.hash)))
  const [restoreError,setRestoreError]=useState('')
  const [savedDesign,setSavedDesign]=useState<{receipt:SavedDesignReceipt;signature:string}|null>(null)
  const [preparedOrder,setPreparedOrder]=useState<{
    key:string;packet:Awaited<ReturnType<typeof createCustomerPacket>>
  }|null>(null)
  const [error,setError]=useState('')
  const [chapterNotice,setChapterNotice]=useState<string|null>(null)
  const [dragging,setDragging]=useState(false)
  const [photoDecodeBusy,setPhotoDecodeBusy]=useState(false)
  const upload=useRef<HTMLInputElement>(null)
  const photoObject=useRef('')
  const overlayObject=useRef('')
  const cutoutObject=useRef('')
  const detectionVersion=useRef(0)
  const astronomyVersion=useRef(0)
  const lookupVersion=useRef(0)
  const detectionOnDecode=useRef(true)
  const [draftReady,setDraftReady]=useState(()=>Boolean(parseDesignLink(window.location.hash)))
  // Physical-light choices depend on the FINAL perspective and visible photo.
  // Recompute on camera/crop changes; retain the unchanged digital astronomy.
  const physicalView=useMemo(()=>design.astronomy&&dimensions
    ?makePhysicalView(design,{heading,pitch,fov,layout:placement,
      skyHeight:skyPercent,imageAspect:dimensions.width/dimensions.height,
      maskAlpha:savedAlpha,maskDimensions:dimensions,photoFit})
    :null,[design,heading,pitch,fov,placement,skyPercent,dimensions,savedAlpha,photoFit])
  const activeDesign=useMemo<DesignSpec>(()=>{
    if(!physicalView||!dimensions)return design
    return {...design,physicalStars:physicalView.physicalStars,
      physicalSelection:{...physicalView.physicalSelection,
        view:{heading,pitch,fov,layout:placement,skyHeight:skyPercent,
          imageAspect:dimensions.width/dimensions.height}}}
  },[design,physicalView,dimensions,heading,pitch,fov,placement,skyPercent])
  const physicalStarIds=useMemo(()=>
    new Set((activeDesign.physicalStars??[]).map(s=>s.hipparcosId)),
    [activeDesign.physicalStars])
  function resetPhysicalLights(){
    setDesign(current=>({...current,physicalStarOverrides:undefined}))
    setPhysicalMessage('')
    setPhysicalRestoreId(id=>id+1)
  }
  function togglePhysicalLight(hip:number){
    setPhysicalRestoreId(0)
    if(!physicalView)return
    const target=physicalView.candidates.find(c=>c.star.hipparcosId===hip)
    if(!target){
      setPhysicalMessage('That star is outside the final print-safe light area or hidden by the foreground. Try another star or adjust your view in Chapter 04.')
      return
    }
    const selected=activeDesign.physicalStars??[]
    const chosen=selected.map(s=>s.hipparcosId)
    if(physicalStarIds.has(hip)){
      setDesign(current=>({...current,physicalStarOverrides:{
        mode:'manual',selectedHipIds:chosen.filter(id=>id!==hip)}}))
      setPhysicalMessage('That star will remain digital-only; its LED is off.')
      return
    }
    const error=physicalToggleError(target,selected,
      physicalView.physicalSelection.maxPhysicalStars,
      physicalView.physicalSelection.minSeparationMm)
    if(error){setPhysicalMessage(error);return}
    setDesign(current=>({...current,physicalStarOverrides:{
      mode:'manual',selectedHipIds:[...chosen,hip]}}))
    setPhysicalMessage('This star is now included as a physical light.')
  }

  const [draftNotice,setDraftNotice]=useState('')
  const [draftError,setDraftError]=useState('')

  useEffect(()=>()=> {
    detectionVersion.current++
    astronomyVersion.current++
    if(copiedTimeout.current!==null)window.clearTimeout(copiedTimeout.current)
    if(photoObject.current) URL.revokeObjectURL(photoObject.current)
    if(overlayObject.current) URL.revokeObjectURL(overlayObject.current)
    if(cutoutObject.current) URL.revokeObjectURL(cutoutObject.current)
  },[])
  // Pricing refresh only while the customer is choosing a physical frame.
  useEffect(()=>{
    if(stage!=='home')return
    let alive=true
    const refresh=()=>{
      void loadFramePrices().then(prices=>{
        if(alive){setFrameQuotes(prices);setPriceNotice('')}
      }).catch(()=>{if(alive)setPriceNotice('Supplier cost catalog unavailable; showing estimates.')})
    }
    refresh()
    const timer=window.setInterval(refresh,180000)
    return()=>{alive=false;window.clearInterval(timer)}
  },[stage])
  async function refreshFramePrices(){
    setPricesLoading(true)
    try{setFrameQuotes(await loadFramePrices());setPriceNotice('Estimates refreshed.')}
    catch{setPriceNotice('Supplier cost catalog unavailable; showing estimates.')}
    finally{setPricesLoading(false)}
  }
  // Opening a private design link does not require an account. A public Etsy Design ID
  // alone is insufficient: only the 256-bit secret in the URL fragment grants read access.
  useEffect(()=>{
    const reference=parseDesignLink(window.location.hash)
    if(!reference)return
    let active=true
    void (async()=>{
      try {
        const loaded=await reopenCustomerDesign(reference)
        if(!active)return
        const type=loaded.original.type||'image/jpeg'
        const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg'
        const restoredPhoto=new File([loaded.original],'saved-photo.'+ext,{type})
        const bitmap=await createImageBitmap(restoredPhoto)
        const width=bitmap.width,height=bitmap.height
        bitmap.close()
        if(!active)return
        detectionVersion.current++
        astronomyVersion.current++
        if(photoObject.current)URL.revokeObjectURL(photoObject.current)
        if(cutoutObject.current)URL.revokeObjectURL(cutoutObject.current)
        if(overlayObject.current)URL.revokeObjectURL(overlayObject.current)
        const originalUrl=URL.createObjectURL(restoredPhoto)
        const foregroundUrl=loaded.foreground?URL.createObjectURL(loaded.foreground):''
        let restoredMask:Uint8ClampedArray|null=null
        if(loaded.foreground)try{
          restoredMask=await restoreCutoutAlpha(loaded.foreground,width,height)
        }catch{/* Keep saved design accessible; physical selection stays proof-only. */}
        if(!active)return
        photoObject.current=originalUrl
        cutoutObject.current=foregroundUrl
        overlayObject.current=''
        const p=loaded.saved.preferences
        const d=loaded.saved.design
        setDesign(d)
        setPhysicalRestoreId(0)
        setPhoto(restoredPhoto)
        setPhotoUrl(originalUrl)
        setCutoutUrl(foregroundUrl)
        setOverlayUrl('')
        setSavedAlpha(restoredMask)
        setDetected(null)
        setDimensions({width,height})
        setPlacement(p.layout)
        setHeading(p.heading)
        setPitch(p.pitch)
        setFov(p.fov)
        setSkyPercent(p.skyHeight)
        setPhotoFit(p.photoFit)
        setSkyTone(p.tone)
        setAtmosphericGlow(p.glow)
        setFinish(p.finish)
        setInscription(p.inscription)
        setDate(d.moment.date)
        setTime(d.moment.time??'21:00')
        setUnknownTime(d.moment.exactTimeUnknown)
        const loc=d.moment.location
        if(loc){
          setSelected({...loc,source:null})
          setQuery(loc.query||loc.displayName)
        }
        setSavedDesign({
          receipt:{designId:loaded.saved.designId,accessKey:reference.accessKey,
            createdAtUtc:loaded.saved.createdAtUtc,status:'SAVED_UNPAID'},
          signature:designSnapshotSignature({design:d,preferences:p,
            photoBytes:restoredPhoto.size,prepared:Boolean(loaded.foreground)}),
        })
        setStage('home')
      }catch(cause){
        if(active)setRestoreError(cause instanceof Error?cause.message:'Could not reopen your design.')
      }finally{if(active)setRestoreBusy(false)}
    })()
    return ()=>{active=false}
  },[])

  // Unpaid work is never uploaded just to survive Refresh. Restore from this
  // origin's IndexedDB first; private link restoration above takes precedence.
  useEffect(()=>{
    if(parseDesignLink(window.location.hash))return
    let active=true
    void (async()=>{
      try{
        const draft=await readLocalWorkshopDraft()
        if(!active)return
        if(!draft){
          setDraftReady(true)
          // Keep test fixtures out of the customer-facing hero. The explicitly
          // requested /?trial=1 route seeds a fresh workshop automatically.
          // Never replace a private saved design or an existing local draft.
          if(trialPhotoMode&&!trialSampleStarted.current){
            trialSampleStarted.current=true
            void loadTrialSample()
          }
          return
        }
        const kind=draft.photo.type
        const extension=kind==='image/png'?'png':kind==='image/webp'?'webp':'jpg'
        const restored=new File([draft.photo],'local-workshop-photo.'+extension,{type:kind})
        const originalUrl=URL.createObjectURL(restored)
        const cutoutUrl=draft.cutout?URL.createObjectURL(draft.cutout):''
        const overlayUrl=draft.detected?URL.createObjectURL(draft.detected.overlay):''
        if(photoObject.current)URL.revokeObjectURL(photoObject.current)
        if(cutoutObject.current)URL.revokeObjectURL(cutoutObject.current)
        if(overlayObject.current)URL.revokeObjectURL(overlayObject.current)
        photoObject.current=originalUrl
        cutoutObject.current=cutoutUrl
        overlayObject.current=overlayUrl
        setPhoto(restored);setPhotoUrl(originalUrl)
        setCutoutUrl(cutoutUrl);setOverlayUrl(overlayUrl)
        setDimensions(draft.dimensions);setDetected(draft.detected)
        setSavedAlpha(draft.savedAlpha)
        setDesign(draft.design)
        setPhysicalRestoreId(0)
        setPlacement(draft.placement);setShowMask(draft.showMask)
        setDate(draft.date);setTime(draft.time);setUnknownTime(draft.unknownTime)
        setQuery(draft.query);setSelected(draft.selected);setOffline(draft.offline)
        setHeading(draft.heading);setPitch(draft.pitch);setFov(draft.fov)
        setSkyPercent(draft.skyPercent);setPhotoFit(draft.photoFit)
        setAtmosphericGlow(draft.atmosphericGlow);setSkyTone(draft.skyTone)
        setLightsOn(draft.lightsOn);setFinish(draft.finish);setRoom(draft.room)
        setInscription(draft.inscription)
        const resumed=resumedDraftStage(draft.stage,Boolean(draft.design.astronomy))
        setStage(resumed)
        setDraftNotice('Your previous work was restored privately from this browser.')
        if(resumed==='detecting')void runDetection(originalUrl)
        if(draft.stage==='calculating')
          setChapterNotice('Your photo and moment are back. Choose Reveal my night to resume the sky calculation.')
        setDraftReady(true)
      }catch{
        if(active){
          setDraftError('This browser cannot restore the previous local draft. You can still upload a photo and use Save Design.')
          setDraftReady(true)
        }
      }
    })()
    return ()=>{active=false}
  },[])

  // Keep just one current working draft per browser/origin. Object URLs are
  // intentionally never persisted: only original bytes and optional cutout.
  useEffect(()=>{
    if(!draftReady||restoreBusy||!photo||!dimensions)return
    let canceled=false
    const timer=window.setTimeout(()=>{
      void (async()=>{
        try{
          let cutout:Blob|null=null
          if(cutoutUrl){
            const response=await fetch(cutoutUrl)
            if(!response.ok)throw new Error('Cannot read the locally prepared foreground.')
            cutout=await response.blob()
          }
          if(canceled)return
          const draft:LocalWorkshopDraft={
            version:1,savedAtMs:Date.now(),photo,
            dimensions,design:activeDesign,stage,placement,detected,cutout,savedAlpha,showMask,
            date,time,unknownTime,query,selected,offline,heading,pitch,fov,
            skyPercent,photoFit,atmosphericGlow,skyTone,lightsOn,finish,room,inscription,
          }
          await writeLocalWorkshopDraft(draft)
          if(!canceled)setDraftError('')
        }catch{
          if(!canceled)setDraftError('This browser could not store your working photo. Use Save Design when it is available, or keep this tab open.')
        }
      })()
    },240)
    return ()=>{canceled=true;window.clearTimeout(timer)}
  },[draftReady,restoreBusy,photo,dimensions,activeDesign,stage,placement,detected,
      cutoutUrl,savedAlpha,showMask,date,time,unknownTime,query,selected,offline,
      heading,pitch,fov,skyPercent,photoFit,atmosphericGlow,skyTone,lightsOn,
      finish,room,inscription])

  // After editing a previously saved design, do not leave the old private
  // receipt URL in the address bar: Refresh must prefer the new local draft.
  useEffect(()=>{
    if(!draftReady||restoreBusy||!savedDesign)return
    const preferences={
      layout:placement,heading,pitch,fov,skyHeight:skyPercent,
      photoFit,tone:skyTone,glow:atmosphericGlow,finish,inscription:inscription.trim(),
    }
    const currentSignature=designSnapshotSignature({design:activeDesign,preferences,
      photoBytes:photo?.size??0,prepared:Boolean(cutoutUrl)})
    if(savedDesign.signature===currentSignature)return
    const current=parseDesignLink(window.location.hash)
    if(current?.designId===savedDesign.receipt.designId)
      window.history.replaceState(null,'',window.location.pathname+window.location.search)
  },[draftReady,restoreBusy,savedDesign,placement,heading,pitch,fov,skyPercent,
      photoFit,skyTone,atmosphericGlow,finish,inscription,activeDesign,photo,cutoutUrl])

  async function discardLocalDraft(){
    if(!window.confirm('Discard this local photo and all unsaved workshop changes? A separately saved design link will still work.'))return
    setDraftReady(false)
    try{
      await clearLocalWorkshopDraft()
      window.location.replace(window.location.pathname+window.location.search)
    }catch{
      setDraftReady(true)
      setDraftError('The local draft could not be cleared. Check your browser storage settings.')
    }
  }

  useEffect(()=>{
    if(stage!=='detecting'&&stage!=='calculating')return
    const timer=window.setInterval(()=>setProgress(n=>Math.min(91,n+Math.max(.6,(93-n)*.12))),190)
    return ()=>window.clearInterval(timer)
  },[stage])

  async function runDetection(url:string) {
    const version=++detectionVersion.current
    setStage('detecting')
    setProgress(7)
    setDetected(null)
    setDetectorError('')
    setError('')
    if(overlayObject.current)URL.revokeObjectURL(overlayObject.current)
    overlayObject.current=''
    setOverlayUrl('')
    try {
      const result=await detectWorkshopSky(url)
      if(version!==detectionVersion.current)return
      const maskUrl=URL.createObjectURL(result.overlay)
      overlayObject.current=maskUrl
      setOverlayUrl(maskUrl)
      setDetected(result)
      // Suggest only; the customer's explicit selection still overrides this.
      setPlacement(recommendedSkyPlacement(result.skyPercent))
      setProgress(100)
      setStage('choice')
    } catch(cause) {
      if(version!==detectionVersion.current)return
      setDetectorError(cause instanceof Error?cause.message:'The sky detector could not run.')
      setPlacement('above')
      setStage('choice')
    }
  }

  function openPhotoReplacement(){
    if(stage==='refine' && !window.confirm('Leave the horizon editor? Unsaved brush or lasso changes will be lost.'))return
    if(stage==='calculating')astronomyVersion.current++
    if(stage==='detecting'){
      detectionVersion.current++ // Old detection cannot navigate away after the picker opens.
      detectionOnDecode.current=false
    }
    setStage('welcome')
    setPhotoDecodeBusy(false)
    setChapterNotice('Choose a new photograph. Your current image stays here if you cancel the picker.')
    window.scrollTo({top:0,behavior:'smooth'})
    upload.current?.click()
  }

  async function acceptPhoto(file?:File) {
    if(!file)return
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>MAX_PHOTO){
      setError('Choose a JPG, PNG or WebP photograph smaller than 10 MB.')
      return
    }
    detectionVersion.current++
    astronomyVersion.current++
    detectionOnDecode.current=true
    if(photoObject.current)URL.revokeObjectURL(photoObject.current)
    if(overlayObject.current)URL.revokeObjectURL(overlayObject.current)
    if(cutoutObject.current)URL.revokeObjectURL(cutoutObject.current)
    const url=URL.createObjectURL(file)
    photoObject.current=url
    overlayObject.current=''
    cutoutObject.current=''
    setPhoto(file)
    setPhotoUrl(url)
    setOverlayUrl('')
    setCutoutUrl('')
    setSavedAlpha(null)
    setDimensions(null)
    setDetected(null)
    setPlacement('above') // No positive sky detection yet: safer initial composition.
    setCopied(null)
    if(copiedTimeout.current!==null)window.clearTimeout(copiedTimeout.current)
    setError('')
    setChapterNotice(null)
    setSelected(null)
    setQuery('')
    setCandidates([])
    setDesign({...INITIAL_DESIGN_SPEC,stars:[],astronomy:null})
    setPhysicalRestoreId(0)
    setSavedDesign(null)
    setSaveError('')
    window.history.replaceState(null,'',window.location.pathname+window.location.search)
    setPhotoDecodeBusy(true)
    setStage('welcome')
    try{
      const bitmap=await createImageBitmap(file)
      const width=bitmap.width, height=bitmap.height
      bitmap.close()
      if(photoObject.current!==url)return
      const ratio=Math.max(.35,Math.min(3,width/height))
      // Retail product is the fixed 11×14 mounting panel, regardless of photo shape.
      // Source image aspect affects fitting, never the physical frame geometry.
      const {physicalArtwork,regions}=getFrameLayout('11x14')
      setDimensions({width,height})
      setPhotoDecodeBusy(false)
      setDesign(current=>({...current,framePresetId:'11x14',photoAspectRatio:ratio,
        physicalArtwork,regions,photo:{...current.photo,assetId:'local-photo',
          fitMode:'contain',crop:FULL_PHOTO_CROP,positionMm:toRect(regions.engravingPhoto)},
        customText:{...current.customText,positionMm:toRect(regions.text)},stars:[],astronomy:null}))
      if(detectionOnDecode.current)await runDetection(url)
    }catch(cause){
      if(photoObject.current!==url)return
      setPhotoDecodeBusy(false)
      setError(cause instanceof Error?cause.message:'The photograph could not be opened.')
      setStage('welcome')
    }
  }

  async function loadTrialSample(){
    if(photo && !window.confirm('Replace this photo with the synthetic trial photograph?'))return
    try{
      const trial=await createTrialPhoto()
      await acceptPhoto(trial)
      // After acceptPhoto clears the old place, seed a known date/time/location
      // for the normal, real astronomy calculation in Chapter 03.
      setDate(TRIAL_DATE)
      setTime(TRIAL_TIME)
      setUnknownTime(false)
      setSelected(SAMPLE_LOCATIONS[0])
      setQuery(SAMPLE_LOCATIONS[0].displayName)
      setOffline(false)
      setChapterNotice('Trial photo and example date/place loaded. Continue through the real workshop. Nothing has been saved or purchased.')
    }catch(error){
      setError(error instanceof Error?error.message:'Could not prepare the trial photograph.')
    }
  }
  function onDrop(event:DragEvent<HTMLElement>){
    event.preventDefault()
    setDragging(false)
    void acceptPhoto(event.dataTransfer.files[0])
  }
  function choosePlacement(){
    setError('')
    setChapterNotice(null)
    setStage(placement==='within'?'refine':'moment')
  }
  function saveMask(blob:Blob,alpha:Uint8ClampedArray){
    if(cutoutObject.current)URL.revokeObjectURL(cutoutObject.current)
    const url=URL.createObjectURL(blob)
    cutoutObject.current=url
    setCutoutUrl(url)
    setSavedAlpha(alpha)
    setStage('moment')
  }
  function editMoment(){
    astronomyVersion.current++
    setError('')
    setStage('moment')
  }
  /** Top chapter navigation is intentionally not tied to linear progress.
   * Revisiting completed chapters keeps the selected photo, sky and finish.
   * Moving forward routes to the closest missing prerequisite when needed. */
  function goToChapter(index:ChapterIndex){
    if(restoreBusy){
      setChapterNotice('Your saved design is still opening. Try again once it is ready.')
      return
    }
    const savedMoment=design.moment
    const location=savedMoment.location
    const hasCurrentSky=Boolean(design.astronomy && location && selected &&
      savedMoment.date===date &&
      savedMoment.exactTimeUnknown===unknownTime &&
      (unknownTime || savedMoment.time===time) &&
      Math.abs(location.latitude-selected.latitude)<.000001 &&
      Math.abs(location.longitude-selected.longitude)<.000001)
    const destination=chapterDestination(index,{
      hasPhoto:Boolean(photo),
      hasDimensions:Boolean(dimensions),
      detectionReady:Boolean(detected || detectorError || cutoutUrl || savedDesign),
      placement,hasForeground:Boolean(cutoutUrl),skyCurrent:hasCurrentSky,
    })
    if(stage==='refine' && destination.stage!=='refine' &&
       !window.confirm('Leave the horizon editor? Any unsaved brush or mask changes will be lost.')){
      return
    }
    if(stage==='detecting' && destination.stage!=='detecting'){
      detectionVersion.current++ // Ignore late AI results if chapter 01 was chosen.
      detectionOnDecode.current=false // Also handle an image still being decoded.
    }
    if(stage==='calculating'){
      astronomyVersion.current++ // Do not let an old computation override navigation.
    }
    if(destination.stage==='detecting'){
      detectionOnDecode.current=true
      // If image decoding is in progress acceptPhoto will run detection on completion.
      // If decoding finished and we deliberately left this stage, restart detection.
      if(stage!=='detecting' && dimensions && photoUrl)void runDetection(photoUrl)
    }
    setChapterNotice(destination.notice)
    setError('')
    setStage(destination.stage)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function findPlace(){
    const term=query.trim()
    if(term.length<2){setError('Enter at least two characters for your place.');return}
    const version=++lookupVersion.current
    setIsSearching(true)
    setError('')
    setCandidates([])
    setSelected(null)
    try{
      const matches=offline?await searchOfflineCities(term):await searchLocations(term)
      if(version!==lookupVersion.current)return
      setCandidates(matches)
      if(!matches.length)setError(offline?'No matching city found. Try a nearby town.':'No places found. Try a fuller address.')
    }catch{
      try{
        const matches=await searchOfflineCities(term)
        if(version!==lookupVersion.current)return
        setOffline(true)
        setCandidates(matches)
        if(!matches.length)setError('Live address search is unavailable. Try a city or town.')
      }catch{
        if(version===lookupVersion.current)setError('Could not search locations. Please try again.')
      }
    }finally{
      if(version===lookupVersion.current)setIsSearching(false)
    }
  }
  async function revealNight(){
    setChapterNotice(null)
    if(!photo||!dimensions){setError('Choose a photograph first.');return}
    if(placement==='within'&&!cutoutUrl){setError('Please save your sky cleanup first.');setStage('refine');return}
    if(!date){setError('Choose your special date.');return}
    if(!unknownTime&&!time){setError('Choose a time, or mark the exact time unknown.');return}
    if(!selected){setError('Choose your location from the search results before continuing.');return}
    const version=++astronomyVersion.current
    setError('')
    setProgress(7)
    setStage('calculating')
    try{
      const moment=isOfflineCity(selected)||isSampleLocation(selected)
        ? resolveSampleMoment(date,unknownTime?null:time,unknownTime,selected)
        : await resolveMoment({date,time:unknownTime?null:time,
          exactTimeUnknown:unknownTime,locationQuery:query,location:selected})
      if(version!==astronomyVersion.current)return
      const calculated=await generateAstronomy(moment,design.skySettings,
        design.framePresetId,design.photoAspectRatio)
      if(version!==astronomyVersion.current)return
      setDesign(current=>({...current,physicalStarOverrides:undefined,moment,astronomy:calculated.calculation,
        stars:calculated.displayStars??calculated.stars,
        displayStars:calculated.displayStars??calculated.stars,
        physicalStars:calculated.physicalStars,physicalSelection:calculated.physicalSelection}))
      setHeading(wrapWorkshopHeading(suggestedObserverHeading(calculated.stars)))
      setPitch(18)
      setFov(105)
      setCustomizingLights(false)
      setPhysicalMessage('')
      setPhysicalRestoreId(0)
      setProgress(100)
      setStage('preview')
    }catch(cause){
      if(version!==astronomyVersion.current)return
      setStage('moment')
      setError(cause instanceof Error?cause.message:'We could not reconstruct this night.')
    }
  }

  const atIndex=stage==='welcome'?0:stage==='detecting'||stage==='choice'||stage==='refine'?1:
    stage==='moment'||stage==='calculating'?2:stage==='home'?4:3
  const chosenName=selected?.displayName||'Your special place'
  const frameQuote=frameQuoteFor(frameQuotes,finish)
  const orderPreferences:OrderPreferences={
    layout:placement,heading,pitch,fov,skyHeight:skyPercent,
    photoFit,tone:skyTone,glow:atmosphericGlow,finish,inscription:inscription.trim(),
  }
  const snapshotSignature=designSnapshotSignature({design:activeDesign,preferences:orderPreferences,
    photoBytes:photo?.size??0,prepared:Boolean(cutoutUrl)})
  const savedCurrent=Boolean(savedDesign&&savedDesign.signature===snapshotSignature)
  const orderKey=JSON.stringify({moment:activeDesign.moment,stars:activeDesign.stars,
    physicalStars:activeDesign.physicalStars,physicalSelection:activeDesign.physicalSelection,
    physicalStarOverrides:activeDesign.physicalStarOverrides,
    preferences:orderPreferences,photo:photo?.name,photoSize:photo?.size,cutoutUrl,
    priceRevision:frameQuote?.revision,priceCents:frameQuote?.priceCents})
  // A packet without the server-issued saved Design ID cannot be matched to Etsy.
  const currentOrder=preparedOrder?.key===orderKey&&savedCurrent&&
    preparedOrder.packet.manifest.reference===savedDesign?.receipt.designId
    ?preparedOrder.packet:null
  const selectedEtsyListing=etsyListingForFinish(finish,{
    walnut:import.meta.env.VITE_ETSY_LISTING_WALNUT_URL as string|undefined,
    ebony:import.meta.env.VITE_ETSY_LISTING_EBONY_URL as string|undefined,
    shared:import.meta.env.VITE_ETSY_LISTING_URL as string|undefined,
  })
  const etsyCheckoutReady=canContinueToEtsy({
    designSaved:savedCurrent,
    savedDesignId:savedDesign?.receipt.designId,
    manifest:currentOrder?.manifest??null,
    listing:selectedEtsyListing,
  })

  async function saveDesignNow():Promise<SavedDesignReceipt|null>{
    if(savedCurrent&&savedDesign)return savedDesign.receipt
    if(!photo||!design.astronomy||!design.moment.location){
      setSaveError('Finish your night sky before saving.')
      return null
    }
    if(placement==='within'&&!cutoutUrl){
      setSaveError('Finish and save the polished foreground first.')
      return null
    }
    setSaveBusy(true)
    setSaveError('')
    const signature=snapshotSignature
    try{
      let foreground:Blob|null=null
      if(placement==='within'){
        const response=await fetch(cutoutUrl)
        if(!response.ok)throw new Error('Could not read the prepared foreground.')
        foreground=await response.blob()
      }
      const receipt=await saveCustomerDesign({
        design:activeDesign,preferences:{...orderPreferences},photo,foreground,
      })
      setSavedDesign({receipt,signature})
      window.history.replaceState(null,'',privateDesignLink(window.location.href,receipt))
      return receipt
    }catch(cause){
      setSaveError(cause instanceof Error?cause.message:'Unable to save your design.')
      return null
    }finally{setSaveBusy(false)}
  }

  async function copyWithFeedback(text:string,kind:'link'|'order'|'details'){
    try{
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      if(copiedTimeout.current!==null)window.clearTimeout(copiedTimeout.current)
      copiedTimeout.current=window.setTimeout(()=>setCopied(null),3400)
    }catch{
      if(kind==='link')setSaveError('Copy failed. Try copying this page address from your browser.')
      else setOrderError('Could not copy automatically. Select the Design ID shown below and copy it, then paste it into Etsy.')
    }
  }

  async function buildOrderPacket(){
    if(currentOrder)return
    if(!photo)return
    if(!activeDesign.physicalStars?.length){
      setOrderError('Choose a view with at least one physical star light before preparing your Etsy order.')
      return
    }
    const key=orderKey
    const preferences={...orderPreferences}
    setOrderBusy(true);setOrderError('')
    try{
      // Save the customer's *exact* frame finish, night sky and photo first.
      // The server-created SK-ID is the only Etsy personalization ID our
      // paid-order importer will accept. A local checksum must never reach Etsy.
      const receipt=savedCurrent&&savedDesign
        ?savedDesign.receipt:await saveDesignNow()
      if(!receipt)throw Error('Your design could not be securely saved. Please save it before ordering.')
      const packet=await createCustomerPacket({design:activeDesign,prefs:preferences,
        photo,photoUrl,cutoutUrl,quote:frameQuote,
        savedDesignId:receipt.designId})
      // Privately freeze exact maker ZIP before enabling Etsy checkout.
      await freezeManufacturingPacket(receipt,packet)
      setPreparedOrder({key,packet})
    }catch(cause){
      setOrderError(cause instanceof Error?cause.message:'Could not prepare your order files.')
    }finally{setOrderBusy(false)}
  }

  if(!draftReady)return <div className="at-shell at-draft-loading" role="status">
    <span className="at-kicker">STARKEEPSAKE / YOUR WORKSHOP</span>
    <span className="at-draft-pulse" aria-hidden="true">✦</span>
    <p>Opening your private work in this browser…</p>
  </div>

  return <div className="at-shell">
    <div className="at-aurora" aria-hidden="true"/>
    <header className="at-header">
      <button type="button" className="at-wordmark" onClick={()=>goToChapter(0)} aria-label="StarKeepsake home">
        <span className="at-logo-mark" aria-hidden="true"><img src="/navbar-compass.svg?v=1" alt="" /></span><span>STAR<span>KEEPSAKE</span><small>THE NIGHT ATELIER</small></span>
      </button>
      <nav className="at-steps" aria-label="Jump between the five workshop chapters">
        {STEPS.map((item,index)=><button type="button" key={item.key}
          className={index===atIndex?'is-current':index<atIndex?'is-done':''}
          aria-current={index===atIndex?'step':undefined}
          aria-label={`Chapter ${index+1}: ${item.label}`}
          title={`Go to chapter ${index+1}: ${item.label.toLowerCase()}`}
          onClick={()=>goToChapter(index as ChapterIndex)}>
          <span>{index<atIndex?'✓':String(index+1).padStart(2,'0')}</span><b>{item.label}</b>
        </button>)}
      </nav>
    </header>
    <main className="at-main">
      {draftNotice&&<div className="at-local-draft-info" role="status">
        <span>✓ {draftNotice}</span>
        <button type="button" onClick={()=>setDraftNotice('')} aria-label="Dismiss local draft notice">×</button>
      </div>}
      {draftError&&<p role="alert" className="at-error at-draft-error">{draftError}</p>}
      {chapterNotice&&<p role="status" className="at-chapter-notice">{chapterNotice}</p>}
      {restoreBusy&&<p role="status" className="at-design-notice">Opening your private saved design…</p>}
      {restoreError&&<div className="at-design-notice" role="alert">
        Could not open saved design: {restoreError}
        <button type="button" onClick={()=>{window.history.replaceState(null,'',window.location.pathname);setRestoreError('')}}>
          Start a new design</button>
      </div>}
      {stage==='welcome'&&<section className="at-welcome at-appear">
        <div className="at-welcome-copy">
          <span className="at-kicker">WELCOME TO THE NIGHT ATELIER</span>
          <h1>Every moment<br/>has <em>its own sky.</em></h1>
          <p>A photograph to remember. The real stars from that very night.
            Together, we’ll make something worth keeping.</p>
          <div className="at-welcome-caption"><span>01 / BEGIN WITH A PHOTOGRAPH</span>
            <span>02 / WE’LL FIND YOUR SKY</span><span>03 / MAKE IT YOURS</span></div>
          <button type="button" className="at-primary" onClick={()=>upload.current?.click()}>
            {photo?'Replace your photograph':'Choose your photograph'} <span>↗</span></button>
          {photo&&<button type="button" className="at-outline at-welcome-resume"
            onClick={()=>goToChapter(1)}>Continue with this photo ↗</button>}
          {photo&&<button type="button" className="at-reset-draft"
            onClick={()=>void discardLocalDraft()}>Clear this device's draft and start over</button>}
          {photoDecodeBusy&&<div className="at-photo-replacement-loader" role="status" aria-live="polite">
            <span className="at-photo-loader-orbit" aria-hidden="true">✦</span>
            <span><strong>Preparing your new photograph…</strong>
              <small>Reading its size and getting the sky detector ready.</small></span>
          </div>}
          <small>{photo?'Your photo and choices remain on this device for up to 30 days, unless you clear the draft. Other users of this browser may see them.':'JPG, PNG or WebP · up to 10 MB · Your image stays on your device during sky detection.'}</small>
          {error&&<p className="at-error" role="alert">{error}</p>}
        </div>
        <div className={`at-welcome-art ${dragging?'is-dragging':''}`}
          onDragOver={event=>{event.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)} onDrop={onDrop}>
          <div className="at-orbit-ring" aria-hidden="true"><i/><i/></div>
          <div className={`at-sample-frame ${photoUrl?'at-existing-photo':''}`} aria-hidden="true">
            {photoUrl?<img src={photoUrl} alt=""/>:<>
              <div className="at-sample-sky"><span>✦</span><span>·</span><span>✧</span><span>·</span></div>
              <div className="at-sample-landscape"/>
            </>}
            <span className="at-sample-signature">{photoUrl?'CURRENT PHOTOGRAPH':'A NIGHT TO REMEMBER'}</span>
          </div>
          <button type="button" onClick={()=>upload.current?.click()}>
            <span>＋</span> {dragging?'Drop your photograph here':photo?'Change this photograph':'Or drop your image here'}
          </button>
        </div>
      </section>}

      {(stage==='detecting'||stage==='calculating')&&<section className={`at-quiet-stage at-appear ${dragging?'is-dragging':''}`}
        onDragOver={event=>{if(stage==='detecting'){event.preventDefault();setDragging(true)}}}
        onDragLeave={()=>setDragging(false)} onDrop={event=>{if(stage==='detecting')onDrop(event)}}>
        <WizardLoader kind={stage} progress={progress}/>
        {stage==='detecting'&&<div className="at-loading-change">
          <button type="button" className="at-outline" onClick={openPhotoReplacement}>
            ⇄ Replace this photo now
          </button>
          <span>Or drop a different picture here — you don't have to wait.</span>
        </div>}
      </section>}

      {stage==='choice'&&<section className="at-atelier-stage at-appear">
        <div className="at-stage-intro">
          <span className="at-kicker">CHAPTER 02 / THE HORIZON</span>
          <h1>Where should<br/><em>your stars live?</em></h1>
          <p>We’ve examined your photograph for open sky. Now choose how it should meet the night you remember.</p>
        </div>
        <div className="at-choice-layout">
          <div className={`at-detection-panel ${dragging?'is-dragging':''}`}
            onDragOver={event=>{event.preventDefault();setDragging(true)}}
            onDragLeave={()=>setDragging(false)} onDrop={onDrop}>
            <div className="at-panel-heading"><strong>YOUR PHOTOGRAPH</strong>
              <span role="status">{detectorError?'DETECTION UNAVAILABLE'
                :detected&&detected.skyPercent>=3?'AI HORIZON FOUND'
                :savedDesign&&!detected?'SAVED COMPOSITION'
                :'NO CLEAR SKY DETECTED'}</span></div>
            <div className="at-detection-image">
              {photoUrl&&<img src={showMask&&overlayUrl?overlayUrl:photoUrl}
                alt={showMask&&overlayUrl?'Cyan overlay shows the sky the AI found in your photograph':'Your original photograph'}/>}
              {detected&&detected.skyPercent>=3&&showMask&&<div className="at-mask-key"><i/> Blue marks the sky we found</div>}
            </div>
            <div className="at-detection-foot">
              <label><input type="checkbox" checked={showMask} onChange={event=>setShowMask(event.target.checked)}/>
                Show detected sky</label>
              <button type="button" onClick={()=>{if(photoUrl)void runDetection(photoUrl)}}>↻ Detect again</button>
            </div>
            <button type="button" className="at-detection-change-photo"
              onClick={openPhotoReplacement} aria-label="Change photograph">
              <span aria-hidden="true">⇄</span> Change photograph <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="at-decision">
            <div className="at-decision-eyebrow">CHOOSE YOUR COMPOSITION</div>
            <button type="button" aria-pressed={placement==='within'}
              className={`at-option ${placement==='within'?'is-selected':''}`}
              onClick={()=>setPlacement('within')}>
              <span className="at-option-mini is-within"><i>✦ ✧</i><b/></span>
              <span><strong>Stars woven into your photograph</strong><small>Keep the people and landscape you love; let the stars illuminate the sky already in your image.</small></span>
              <span className="at-radio">✦</span>
            </button>
            <button type="button" aria-pressed={placement==='above'}
              className={`at-option ${placement==='above'?'is-selected':''}`}
              onClick={()=>setPlacement('above')}>
              <span className="at-option-mini is-above"><i>✦ ✧</i><b/></span>
              <span><strong>A new sky above your memory</strong><small>Keep your entire photograph untouched and place a separate starry heaven above it.</small></span>
              <span className="at-radio">✦</span>
            </button>
            <button type="button" className="at-primary at-wide" onClick={choosePlacement}>
              {placement==='within'?'Polish my horizon':'Continue with a sky above'} <span>↗</span>
            </button>
            <p className="at-tiny-note">Sky detection runs on your device. If you choose to weave stars into the image, you’ll get a chance to tidy the edges with free editing tools.</p>
          </div>
        </div>
      </section>}

      {stage==='refine'&&<section className="at-quiet-stage at-appear">
        <span className="at-kicker">CHAPTER 02 / THE FINISHING TOUCHES</span>
        <h1>Make the horizon <em>your own.</em></h1>
        <p className="at-refine-prompt">Touch up the blue AI sky selection with a magic wand, brush or traced area, then save your transparent foreground to continue.</p>
        <button type="button" className="at-outline" onClick={()=>setStage('choice')}>← Back to placement choices</button>
      </section>}

      {stage==='moment'&&<section className="at-atelier-stage at-appear">
        <div className="at-stage-intro">
          <span className="at-kicker">CHAPTER 03 / A PLACE IN TIME</span>
          <h1>Tell us when<br/><em>the stars were yours.</em></h1>
          <p>A birthday, a first hello, or a day you’ll always keep. We’ll travel back to the actual sky above that place and moment.</p>
        </div>
        <div className="at-moment-layout">
          <div className="at-moment-photo">
            {photoUrl&&<img src={placement==='within'&&cutoutUrl?cutoutUrl:photoUrl}
              alt="Your selected memory, ready for the night sky"/>}
            <span>✦ YOUR MEMORY IS READY</span>
            <button type="button" onClick={()=>setStage('choice')}>↶ Change sky placement</button>
          </div>
          <form className="at-moment-form" onSubmit={event=>{event.preventDefault();void revealNight()}}>
            <span className="at-kicker">LET’S FIND YOUR NIGHT</span>
            <label>THE DATE THAT MATTERS
              <input type="date" required min="1850-01-01" max="2149-12-31" value={date}
                onChange={event=>setDate(event.target.value)}/></label>
            <div className="at-time-row">
              <label>THE LOCAL TIME
                <input type="time" value={time} disabled={unknownTime}
                  onChange={event=>setTime(event.target.value)}/></label>
              <label className="at-time-unknown"><input type="checkbox" checked={unknownTime}
                onChange={event=>setUnknownTime(event.target.checked)}/> Time unknown</label>
            </div>
            <div className="at-location-picker">
              <div className="at-location-heading">
                <label htmlFor="at-location-query">WHERE DID IT HAPPEN?</label>
                <span className={selected?'at-location-complete':'at-location-required'}>
                  {selected?'✓ Selected':'Selection required'}
                </span>
              </div>
              <div className="at-search-field">
                <input id="at-location-query" type="search" value={query}
                  placeholder="City, town, landmark or address"
                  aria-describedby="at-location-instructions"
                  aria-controls={candidates.length>0?'at-location-results':undefined}
                  aria-expanded={candidates.length>0}
                  onChange={event=>{lookupVersion.current++;setQuery(event.target.value);
                    setCandidates([]);setSelected(null)}}
                  onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void findPlace()}}}/>
                <button type="button" onClick={()=>void findPlace()} disabled={isSearching}>
                  <span className="at-search-button-content">
                {isSearching&&<span className="at-search-spinner" aria-hidden="true"/>}
                {isSearching?'Searching the sky map…':'Find places'}
              </span></button>
              </div>
              <p id="at-location-instructions" className="at-place-instructions">
                <span className={selected?'is-complete':''}>1. Search for your place</span>
                <span className={selected?'is-complete':candidates.length?'is-current':''}>
                  2. <strong>Select the matching location</strong> from the list
                </span>
              </p>
              {isSearching&&<div className="at-search-pending" role="status" aria-live="polite">
                <span className="at-search-pending-title">✦ Searching for matching places…</span>
                <div className="at-place-skeleton" aria-hidden="true"><i/><i/><i/></div>
              </div>}
              {candidates.length>0&&<section className="at-place-results-panel"
                aria-label="Choose a matching search result">
                <div className="at-place-results-header" role="status" aria-live="polite">
                  <span className="at-place-step-number">2</span>
                  <div><strong>Choose your location below</strong>
                    <small>Search complete — click the correct result to confirm your place.</small>
                  </div>
                  <span className="at-place-point-arrow" aria-hidden="true">↓</span>
                </div>
                <div id="at-location-results" className="at-place-results" role="group"
                  aria-label="Matching locations">
                  {candidates.slice(0,7).map((item,index)=><button type="button"
                    key={`${item.latitude}-${item.longitude}-${index}`}
                    aria-label={`Select ${item.displayName} as the event location`}
                    onClick={()=>{setSelected(item);setCandidates([]);setError('')}}>
                    <span className="at-place-pin" aria-hidden="true">⌖</span>
                    <span className="at-place-result-name">{item.displayName}</span>
                    <span className="at-place-result-action" aria-hidden="true">Select ↗</span>
                  </button>)}
                </div>
              </section>}
              {selected&&<div className="at-place-confirm" role="status" aria-live="polite">
                <span className="at-place-confirm-check" aria-hidden="true">✓</span>
                <div><strong>Location confirmed</strong><span>{selected.displayName}</span>
                  <small>You're ready to reveal your night.</small></div>
                <button type="button" onClick={()=>{setSelected(null);setCandidates([])}}
                  aria-label="Change the selected location">Change</button>
              </div>}
            </div>
            {offline&&<p className="at-tiny-note">Using our offline city index. Exact addresses need the live search service.</p>}
            {selected?.source==='geoapify'&&<p className="at-tiny-note">
              Location search powered by <a href="https://www.geoapify.com/" target="_blank"
                rel="noopener noreferrer">Geoapify</a> using OpenStreetMap and other sources.</p>}
            {error&&<p className="at-error" role="alert">{error}</p>}
            <button className="at-primary at-wide" type="submit" disabled={!selected}>
              Reveal my night <span>✦</span>
            </button>
            {!selected&&<p className="at-place-continue-hint" role="status">
              Choose a location from the search results to unlock this step.
            </p>}
            <p className="at-tiny-note">We calculate the real stars for your chosen location and time. The photograph’s camera direction will be yours to choose next.</p>
          </form>
        </div>
      </section>}

      {stage==='preview'&&<section className="at-preview-stage at-observatory-stage at-appear">
        <header className="at-observatory-heading">
          <div>
            <span className="at-kicker">CHAPTER 04 / THE OBSERVATORY WORKSHOP</span>
            <h1>Explore <em>your night sky.</em></h1>
            <p>Move the sky to match your memory. Drag the frame or use the
              direction controls to explore the stars above that place.</p>
          </div>
          <div className="at-observatory-context" aria-label="Your selected sky moment">
            <span>YOUR OBSERVATION</span>
            <strong>{chosenName}</strong>
            <small>{date}</small>
          </div>
        </header>
        <div className="at-preview-grid">
          <section className="at-preview-main" aria-label="Interactive sky and photograph">
            <SkyWorkshopPreview
              showroom={false} lightsOn={lightsOn} finish={finish}
              stars={design.stars}
              physicalStarIds={physicalStarIds} photoUrl={photoUrl} cutoutUrl={cutoutUrl}
              layout={placement}
              imageAspect={dimensions?dimensions.width/dimensions.height:1}
              heading={heading} pitch={pitch} fov={fov} skyHeight={skyPercent}
              photoFit={photoFit} glow={atmosphericGlow} tone={skyTone}
              maskAlpha={savedAlpha} maskDimensions={dimensions}
              showPerspectiveGuide={showPerspectiveGuide}
              editingPhysicalStars={false}
              onPerspectiveInteract={()=>setShowPerspectiveGuide(false)}
              onHeading={v=>{setShowPerspectiveGuide(false);setHeading(wrapWorkshopHeading(v))}}
              onPitch={v=>{setShowPerspectiveGuide(false);setPitch(clampWorkshopPitch(v))}}/>
            <div className="at-preview-caption">
              <div><span>LOCATION & DATE</span><strong>{chosenName}</strong>
                <small>{date}</small></div>
              <div><span>CALCULATED SKY</span>
                <strong>{design.stars.length} Hipparcos stars</strong>
                <small>The illuminated stars are selected in Chapter 05.</small></div>
            </div>
            <div className="at-observatory-quick-controls">
              {placement==='above'&&<details className="at-observatory-disclosure">
                <summary><span>Photo framing</span>
                  <small>{skyPercent}% sky · Fit and crop</small></summary>
                <div className="at-balance-box">
                  <label>Sky portion <strong>{skyPercent}%</strong>
                    <input type="range" min="20" max="70" value={skyPercent}
                      onChange={e=>setSkyPercent(Number(e.target.value))}/></label>
                  <div className="at-fit-list">{photoFits.map(item=><button
                    key={item.id} type="button" className={photoFit===item.id?'is-selected':''}
                    onClick={()=>setPhotoFit(item.id)}>{item.label}</button>)}</div>
                </div>
              </details>}
              <details className="at-observatory-disclosure">
                <summary><span>Light & atmosphere</span>
                  <small>{skyTone==='natural'?'Natural darkness':skyTone==='indigo'?
                    'Midnight indigo':'Deep teal'} · {atmosphericGlow?'Glow on':'Glow off'}</small>
                </summary>
                <div className="at-sky-atmosphere-controls">
                  <label className="at-glow-choice"><input type="checkbox"
                    checked={atmosphericGlow}
                    onChange={event=>setAtmosphericGlow(event.target.checked)}/>
                    Horizon glow</label>
                  <fieldset className="at-tone-choice"><legend>Night sky tone</legend>
                    {([['natural','Natural darkness'],['indigo','Midnight indigo'],
                      ['teal','Deep teal']] as const).map(([value,label])=>
                      <button key={value} type="button" aria-pressed={skyTone===value}
                        onClick={()=>setSkyTone(value)}>{label}</button>)}
                  </fieldset>
                  <small>Atmosphere changes the preview, not the calculated star positions.</small>
                </div>
              </details>
            </div>
          </section>
          <aside className="at-preview-sidebar" aria-label="Perspective and workshop controls">
            <section className="at-observatory-perspective" aria-label="Camera perspective controls">
              <div className="at-side-heading">
                <span className="at-kicker">01 / VIEW CONTROLS</span>
                <h2>Find your viewpoint</h2>
                <p>Face a direction, then fine-tune your view.</p>
              </div>
              <SkyWorkshopOrientation heading={heading} pitch={pitch} fov={fov}
                onHeading={v=>{setShowPerspectiveGuide(false);setHeading(wrapWorkshopHeading(v))}}
                onPitch={v=>{setShowPerspectiveGuide(false);setPitch(clampWorkshopPitch(v))}}
                onFov={v=>{setShowPerspectiveGuide(false);setFov(v)}}
                onReset={()=>{setShowPerspectiveGuide(false);setHeading(wrapWorkshopHeading(suggestedObserverHeading(design.stars)));setPitch(18);setFov(105)}}/>
            </section>
            <details className="at-observatory-disclosure at-observatory-edit">
              <summary><span>Change the original details</span>
                <small>Date, location or photograph</small></summary>
              <div className="at-workshop-actions">
                <button type="button" onClick={editMoment}>Change date or location</button>
                <button type="button" onClick={()=>setStage('choice')}>Change photo composition</button>
                {placement==='within'&&<button type="button"
                  onClick={()=>setStage('refine')}>Refine the horizon again</button>}
                <button type="button" onClick={openPhotoReplacement}>Choose another photograph</button>
              </div>
            </details>
            <div className="at-observatory-next">
              <span className="at-kicker">NEXT / YOUR KEEPSAKE</span>
              <strong>See it in your space.</strong>
              <p>Choose a frame finish and the stars that will illuminate.</p>
              <button type="button" className="at-primary"
                onClick={()=>{
                  if(dimensions&&dimensions.width/dimensions.height<.82&&room==='warm'){
                    setRoom('portrait')
                  }
                  setStage('home')
                  window.scrollTo({top:0,behavior:'smooth'})
                }}>
                See my keepsake in a room <span>↗</span>
              </button>
            </div>
          </aside>
        </div>
        <p className="at-science-caveat">Star positions are calculated for your location, date
          and local time. Perspective is adjustable, but not automatically calibrated
          to the camera direction or lens of the photograph. This artistic preview
          is not a manufacturing-ready file. StarKeepsake is not affiliated with NASA.</p>
      </section>}

      {stage==='home'&&<section className="at-home-stage at-appear">
        <div className="at-home-heading">
          <span className="at-kicker">CHAPTER 05 / BRING YOUR NIGHT HOME</span>
          <h1>A memory made<br/><em>to live with.</em></h1>
          <p>Imagine your moment on the wall, gently illuminated after dark.
            Choose which stars shine in the physical frame, find your finish, and picture it at home.</p>
        </div>
        <div className="at-home-layout">
          <div className="at-home-left">
            <HomeShowroom room={room} lightsOn={lightsOn}
              imageAspect={placement==='above'
                ? skyAboveArtworkAspect(dimensions?dimensions.width/dimensions.height:1,skyPercent)
                :dimensions?dimensions.width/dimensions.height:1}>
              <SkyWorkshopPreview
                showroom={true} lightsOn={lightsOn} finish={finish}
                stars={!physicalInspector||physicalOnly?(activeDesign.physicalStars??[]):design.stars}
              physicalStarIds={physicalStarIds} photoUrl={photoUrl} cutoutUrl={cutoutUrl}
                layout={placement}
                imageAspect={dimensions?dimensions.width/dimensions.height:1}
                heading={heading} pitch={pitch} fov={fov} skyHeight={skyPercent}
                photoFit={photoFit} glow={atmosphericGlow} tone={skyTone}
                maskAlpha={savedAlpha} maskDimensions={dimensions}
                showPerspectiveGuide={false}
                onPerspectiveInteract={()=>{}}
                onHeading={()=>{}} onPitch={()=>{}}/>
            </HomeShowroom>
            {physicalView&&physicalView.physicalSelection.eligibleStars>24&&
              <section className="at-physical-choices"
                aria-label="Choose which stars have real LED lights">
              <div className="at-physical-choices-heading">
                <div><span className="at-kicker">YOUR ILLUMINATED STARS</span>
                  <strong>{physicalView.physicalStars.length} real star lights ·
                    {' '}{physicalView.visibleDigitalCount} stars in view</strong></div>
                <button type="button" aria-expanded={customizingLights}
                  onClick={()=>{setCustomizingLights(v=>!v);setPhysicalMessage('')}}>
                  {customizingLights?'✓ Done choosing':'✦ Choose illuminated stars'}
                </button>
              </div>
              <p>StarKeepsake automatically lights every safely spaced star in
                your chosen view when there are up to {physicalView.physicalSelection.maxPhysicalStars}.
                For busier skies, the brightest stars and their spacing guide the
                selection. All other stars remain visible digitally.</p>
              <p className="at-physical-capacity-summary">
                Up to 24 illuminated stars per keepsake. You can fine-tune
                which stars light up using the selection controls below.
              </p>
              <p className="at-physical-choice-mode" role="status">
                {design.physicalStarOverrides?.mode==='manual'
                  ?'Manual star choices active. Only your selected lights will illuminate.'
                  :'Automatic selection active. Your frame preview shows the chosen physical lights.'}
              </p>
              {physicalView.candidates.length===0&&<p className="at-physical-warning" role="status">
                No stars currently qualify for an LED in the print-safe area.
                Return to Chapter 04 to adjust the direction or sky composition,
                and check the foreground mask if stars are woven into your photograph.
              </p>}
              {design.physicalStarOverrides?.mode==='manual'&&physicalView.physicalStars.length===0&&
                <p className="at-physical-warning" role="status">
                  Your manual selection currently contains no visible LED stars.
                  Choose stars below, or restore the automatic selection.
                </p>}
              {design.physicalStarOverrides?.mode==='manual'&&!customizingLights&&
                <button type="button" className="at-physical-reset" onClick={resetPhysicalLights}>
                  ↺ Restore automatic LED selection
                </button>}
              {!customizingLights&&physicalRestoreId>0&&
                design.physicalStarOverrides?.mode!=='manual'&&
                <p key={physicalRestoreId} className="at-auto-restored" role="status">
                  <span className="at-auto-restored-check" aria-hidden="true">✓</span>
                  <span><strong>Automatic choices restored.</strong> {' '}
                    {physicalView.physicalStars.length} physical lights selected from
                    {' '}{physicalView.physicalSelection.eligibleStars} print-safe stars.
                    The frame preview has been updated.</span>
                </p>}
              {physicalView.unavailableForDrilling>0&&<small>
                {physicalView.unavailableForDrilling} visible stars are near the
                print edge or outside the matching print crop, so they cannot
                receive drilled lights without revising the composition.</small>}
              {physicalView.tooClose>0&&<small>
                {physicalView.tooClose} stars were left digital-only because
                their projected holes would be too close together.</small>}
              {customizingLights&&<>
                <div className="at-home-star-edit-preview">
                  <p>Tap an outlined star here to add or remove its physical light.
                    This editing map shows the full digital sky so unlit stars
                    remain available for selection. Gold rings are selected;
                    dashed rings are digital-only.</p>
                  <SkyWorkshopPreview
                    showroom={true} lightsOn={true} finish={finish}
                    stars={design.stars} physicalStarIds={physicalStarIds}
                    photoUrl={photoUrl} cutoutUrl={cutoutUrl}
                    layout={placement}
                    imageAspect={dimensions?dimensions.width/dimensions.height:1}
                    heading={heading} pitch={pitch} fov={fov} skyHeight={skyPercent}
                    photoFit={photoFit} glow={atmosphericGlow} tone={skyTone}
                    maskAlpha={savedAlpha} maskDimensions={dimensions}
                    showPerspectiveGuide={false}
                    editingPhysicalStars={true} onTogglePhysicalStar={togglePhysicalLight}
                    onPerspectiveInteract={()=>{}} onHeading={()=>{}} onPitch={()=>{}}/>
                </div>
                <div className="at-physical-choice-actions">
                  <span>{physicalView.physicalSelection.selectedStars} selected /
                    {' '}{physicalView.physicalSelection.maxPhysicalStars} maximum</span>
                  <button type="button" onClick={resetPhysicalLights}>↺ Restore automatic choices</button>
                </div>
                {physicalRestoreId>0&&design.physicalStarOverrides?.mode!=='manual'&&
                  <p key={physicalRestoreId} className="at-auto-restored" role="status">
                    <span className="at-auto-restored-check" aria-hidden="true">✓</span>
                    <span><strong>Automatic choices restored.</strong> {' '}
                      {physicalView.physicalStars.length} physical lights selected from
                      {' '}{physicalView.physicalSelection.eligibleStars} print-safe stars.
                      The frame preview has been updated.</span>
                  </p>}
                <p>Tap a star in the sky or its row below to include/exclude its
                  physical LED. This does not remove it from the digital sky.
                  The cap and minimum hole spacing still apply.</p>
                <div className="at-physical-choice-list">
                  {physicalView.candidates.map(({star})=><button key={star.hipparcosId}
                    type="button" aria-pressed={physicalStarIds.has(star.hipparcosId)}
                    className={physicalStarIds.has(star.hipparcosId)?'is-lit':''}
                    onClick={()=>togglePhysicalLight(star.hipparcosId)}>
                    <span aria-hidden="true">{physicalStarIds.has(star.hipparcosId)?'✦':'✧'}</span>
                    HIP {star.hipparcosId} <small>Magnitude {star.magnitude.toFixed(2)}</small>
                    <strong>{physicalStarIds.has(star.hipparcosId)?'LED ON':'Digital only'}</strong>
                  </button>)}
                </div>
              </>}
              {physicalMessage&&<p role="status" className="at-physical-message">{physicalMessage}</p>}
              <small>Changes to the viewing direction can hide a chosen star;
                review your selection before saving. Physical registration still
                requires a production proof.</small>
            </section>}
            {physicalView&&physicalView.physicalSelection.eligibleStars===0&&
              <p className="at-home-star-notice" role="status">
                No stars qualify for physical lights in this view. Adjust the sky
                direction or photo composition in Chapter 04.
              </p>}
            {physicalView&&physicalView.physicalSelection.eligibleStars<=24&&
              design.physicalStarOverrides?.mode==='manual'&&
              <div className="at-home-star-notice" role="status">
                <span>This saved design uses manually chosen lights.</span>
                <button type="button" onClick={resetPhysicalLights}>
                  ↺ Restore automatic star selection
                </button>
              </div>}
            {physicalInspector&&<section className="at-physical-inspector"
              aria-label="Development physical LED star inspector">
              <div className="at-inspector-header">
                <strong>MANUFACTURING STAR INSPECTOR · DEV ONLY</strong>
                <label><input type="checkbox" checked={physicalOnly}
                  onChange={e=>setPhysicalOnly(e.target.checked)}/>
                  Show physical LED stars only in the showroom</label>
              </div>
              <p>{design.physicalStarOverrides?.mode==='manual'?'Manual':'Automatic'} ·
                {' '}{activeDesign.physicalStars?.length??0} selected /
                {' '}{activeDesign.physicalSelection?.eligibleStars??'unknown'} in view and print-safe ·
                {' '}configured maximum {activeDesign.physicalSelection?.maxPhysicalStars??'unknown'} ·
                {' '}{design.stars.length} digital display stars</p>
              {!design.physicalSelection&&<p role="status">
                This saved design predates physical-star selection. Recalculate the night
                to obtain a verified physical subset; no legacy assumptions were made.</p>}
              {activeDesign.physicalStars&&<div className="at-inspector-table-wrap">
                <table><thead><tr><th>LED</th><th>HIP</th><th>Mag.</th>
                  <th>X mm</th><th>Y mm</th><th>Priority / reason</th></tr></thead>
                  <tbody>{activeDesign.physicalStars.map(star=><tr key={star.hipparcosId}>
                    <td>{star.ledIndex}</td><td>{star.hipparcosId}</td>
                    <td>{star.magnitude.toFixed(2)}</td><td>{(star.printXMm??star.xMm).toFixed(3)}</td>
                    <td>{(star.printYMm??star.yMm).toFixed(3)}</td>
                    <td>{star.selectionReason} ({star.selectionPriority.toFixed(2)})</td>
                  </tr>)}</tbody></table>
              </div>}
              {(activeDesign.physicalStars?.length??0)===0&&<p role="status">
                Zero LEDs selected. Inspect the print-safe candidate count above,
                restore automatic selections if manual mode is active, or adjust
                your sky perspective in Chapter 04.
              </p>}
              <small>Projected print coordinates for this camera view, not a drill-ready plan.
                Compare against the physical printed proof.</small>
            </section>}
            <div className="at-home-customize">
              <fieldset className="at-home-choice">
                <legend><span>02</span> Find your frame finish</legend>
                <div className="at-home-wood-options">{WOOD_OPTIONS.filter(choice=>choice.id!=='oak'||finish==='oak').map(choice=>
                  <button type="button" key={choice.id} aria-pressed={finish===choice.id}
                    onClick={()=>{setFinish(choice.id);setRoom(choice.scene)}}>
                    <i className={`at-home-wood-swatch at-swatch-${choice.id}`} aria-hidden="true"/>
                    <strong>{choice.id==='walnut'?'Two-tone walnut':choice.id==='ebony'?'Matte black':'Natural oak (legacy)'}</strong>
                    <span className="at-frame-option-depth">{choice.id==='walnut'?'2.5″ deep':choice.id==='ebony'?'3.5″ deep':'Legacy design'}</span>
                    <span className="at-frame-option-price">{frameQuoteFor(frameQuotes,choice.id)?
                      moneyUsd(frameQuoteFor(frameQuotes,choice.id)!.priceCents):'Price on request'}</span>
                  </button>)}</div>
                <small>11×14 illuminated luster-photo frame. Both finishes include individually
                  twinkling stars and concealed warm-white accent lighting. Room mockups are
                  illustrative; the frame pictured in each room keeps its original finish.</small>
              </fieldset>
              <div className="at-home-lighting">
                <div><span className="at-home-control-kicker">03 / LIGHT THE STARS</span>
                  <strong>{lightsOn?'Evening ambience · stars glowing':'Daylight ambience · star lights resting'}</strong></div>
                <button type="button" aria-pressed={lightsOn}
                  onClick={()=>setLightsOn(value=>!value)}>
                  {lightsOn?'✦ Turn the stars off':'✧ Illuminate the stars'}
                </button>
              </div>
            </div>
            <p className="at-home-render-note">Your calculated stars and photograph
              are composited into AI-generated photographic frame and room studies.
              These are visual mockups—not real product photographs, verified
              physical materials, exact-scale placement or camera-based AR.
              Final wood, lighting and size
              depend on a tested physical prototype.</p>
          </div>
          <aside className="at-home-right">
            <div className="at-home-spec">
              <span className="at-kicker">MADE FROM YOUR MOMENT</span>
              <h2>Your night, <em>framed.</em></h2>
              <fieldset className="at-home-choice at-home-room">
                <legend><span>01</span> Choose your room</legend>
                <div className="at-home-choice-list">{ROOM_OPTIONS.map(choice=>
                  <button type="button" key={choice.id} aria-pressed={room===choice.id}
                    onClick={()=>setRoom(choice.id)}>
                    <span aria-hidden="true">{choice.symbol}</span>
                    {choice.label}
                  </button>)}</div>
              </fieldset>
              <button type="button" className="at-home-back"
                onClick={()=>{setStage('preview');window.scrollTo({top:0,behavior:'smooth'})}}>
                ← Adjust my sky and perspective
              </button>
            </div>
            <div className="at-customer-order">
              <span className="at-kicker">THE FINISHING TOUCH / YOUR KEEPSAKE</span>
              <h2>Make it <em>yours.</em></h2>
              <p>Make your own illuminated night-sky keepsake. Choose the frame finish,
                preserve your photograph and star map, then carry the saved design
                to Etsy to complete your purchase securely.</p>
              <div className="at-frame-quote" aria-live="polite">
                <small>11×14 PRICE ESTIMATE · {frameQuote?.mode==='catalog'?'CURRENT MATERIAL CATALOG':'PLANNING'}</small>
                <strong>{frameQuote?moneyUsd(frameQuote.priceCents):'Price on request'}</strong>
                <span>{frameQuote?.mode==='catalog'
                  ?'Based on workshop material costs, labor, overhead and pricing policy.'
                  :'Illustrative retail price until supplier-cost data is approved.'}</span>
                <button type="button" disabled={pricesLoading} onClick={()=>void refreshFramePrices()}>
                  {pricesLoading?'Checking prices…':'↻ Refresh estimate'}</button>
                {priceNotice&&<small role="status">{priceNotice}</small>}
                <small>Etsy sets the actual checkout price. This estimate is not a charge,
                  and does not automatically update an Etsy listing.</small>
              </div>
              <label htmlFor="at-order-inscription">A short inscription (optional)</label>
              <input id="at-order-inscription" type="text" maxLength={65}
                value={inscription} placeholder="e.g. The night our story began"
                onChange={event=>setInscription(event.target.value)}/>
              <button type="button" className="at-outline at-wide" disabled={saveBusy||restoreBusy}
                onClick={()=>void saveDesignNow()}>
                {saveBusy?'Saving draft…':savedCurrent?'✓ Draft saved':'Save draft for later'}
              </button>
              {saveError&&<p role="alert" className="at-error">{saveError}</p>}
              {!currentOrder&&<button type="button" className="at-primary at-wide"
                disabled={orderBusy||saveBusy||restoreBusy} onClick={()=>void buildOrderPacket()}>
                {orderBusy?'Saving your keepsake…':'Save design & prepare Etsy order'} <span>✦</span>
              </button>}
              {!currentOrder&&<small className="at-order-intro-note">
                We'll securely save your design, including your photograph, stars and frame
                selection. You'll only need your Design ID to finish ordering on Etsy.
              </small>}
              {orderError&&<p role="alert" className="at-error">{orderError}</p>}
              {currentOrder&&<div className="at-ready-packet at-etsy-simple" role="status">
                <div className="at-order-ready-heading">
                  <strong>✓ Your design is saved!</strong>
                  <small>Everything you customized is safely stored. Just two steps
                    left to order your keepsake on Etsy — no file upload needed.</small>
                </div>
                <div className="at-etsy-handoff-step">
                  <span className="at-etsy-handoff-number">01</span>
                  <div>
                    <strong>Copy your Design ID</strong>
                    <small>This code tells us exactly which photograph, sky and frame
                      you designed.</small>
                    <span className="at-order-reference" aria-label="Your unique Design ID">
                      {currentOrder.manifest.reference}
                    </span>
                    <button type="button" className="at-etsy-copy-id" onClick={()=>
                      void copyWithFeedback(currentOrder.manifest.reference,'order')}>
                      {copied==='order'?'✓ Copied! Ready to paste on Etsy':'Copy my Design ID'}
                    </button>
                  </div>
                </div>
                <div className="at-etsy-handoff-step">
                  <span className="at-etsy-handoff-number">02</span>
                  <div>
                    <strong>Open Etsy and complete your order</strong>
                    <small>On Etsy, paste the code into the box labeled
                      {' '}<b>“StarKeepsake Design ID”</b>, select the matching
                      {' '}<b>{finish==='walnut'?'Two-tone walnut':'Matte black'}</b>
                      {' '}frame finish, then check out. You don't need to upload
                      your photo again.</small>
                    {etsyCheckoutReady&&selectedEtsyListing
                      ?<a className="at-etsy-checkout" href={selectedEtsyListing.url}
                        target="_blank" rel="noopener noreferrer"
                        onClick={()=>{void navigator.clipboard?.writeText(currentOrder.manifest.reference)
                          .then(()=>setCopied('order')).catch(()=>{})}}>
                        Continue to Etsy ↗</a>
                      :<p className="at-checkout-pending">
                        {selectedEtsyListing
                          ?'Your design has changed. Prepare the latest version before ordering.'
                          :'Your design is saved. Etsy checkout is not available for this frame finish yet.'}
                      </p>}
                    <small>Etsy opens in a new tab. Payment and shipping are handled
                      securely by Etsy.</small>
                  </div>
                </div>
                <small className="at-etsy-unpaid-note">This design is saved, not purchased.
                  We'll connect your Etsy order to it once payment is confirmed using
                  the same Design ID.</small>
                <details className="at-maker-backup">
                  <summary>Optional · Keep a copy of your complete design files</summary>
                  <p>Your files are already saved securely for our workshop.
                    This download is just an optional personal backup, not something
                    you need to send to Etsy.</p>
                  <button type="button" onClick={()=>downloadFile(currentOrder.zip,
                    currentOrder.manifest.reference+'-maker-packet.zip')}>
                    Download complete design backup (ZIP)</button>
                </details>
              </div>}
              {savedCurrent&&savedDesign&&<details className="at-saved-design at-saved-design-private">
                <summary>Keep editing later · private reopening link</summary>
                <strong>Saved design: {savedDesign.receipt.designId}</strong>
                <p>Keep this link private. It lets you reopen and edit the design
                  but is not the code to paste into Etsy.</p>
                <button type="button" className="at-outline" onClick={()=>
                  void copyWithFeedback(privateDesignLink(window.location.href,savedDesign.receipt),'link')}>
                  {copied==='link'?'✓ Private link copied!':'Copy private editing link'}
                </button>
                {copied==='link'&&<span className="at-copy-confirmation" role="status">
                  <span aria-hidden="true">✓</span> Private editing link copied.
                </span>}
                <small>Changing choices and saving again creates a new Design ID.
                  Anyone with the private link can reopen your design.</small>
              </details>}
            </div>
          </aside>
        </div>
      </section>}
    </main>
    <footer className="at-footer"><span>✳ STARKEEPSAKE</span><span>THE BEAUTY OF A NIGHT, HELD FOREVER.</span><span>PERSONAL SKY ATELIER · PREVIEW</span></footer>
    {stage==='refine'&&photo&&<SkyMaskEditor key={photoUrl} file={photo}
      initialMask={savedAlpha} detectedMask={detected}
      showPolishGuide={showPolishGuide} onDismissPolishGuide={()=>setShowPolishGuide(false)}
      onChapterNavigate={goToChapter} chapterNotice={chapterNotice}
      onApply={saveMask} onClose={()=>setStage('choice')}/>}
    <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp"
      className="at-hidden-file" aria-label="Upload your photograph"
      onChange={event=>{void acceptPhoto(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>
  </div>
}
