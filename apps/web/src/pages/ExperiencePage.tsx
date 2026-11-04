import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { generateAstronomy, resolveMoment, searchLocations } from '../api'
import type { LocationCandidate } from '../api'
import { SkyMaskEditor } from '../components/SkyMaskEditor'
import { SkyWorkshopPreview, SkyWorkshopOrientation } from '../components/SkyWorkshopPreview'
import { HomeShowroom } from '../components/HomeShowroom'
import { ROOM_OPTIONS, WOOD_OPTIONS } from '../components/HomeShowroomOptions'
import { detectWorkshopSky } from '../skyBlend'
import type { WorkshopDetection } from '../skyBlend'
import { FULL_PHOTO_CROP } from '../photoCrop'
import { INITIAL_DESIGN_SPEC, getFrameLayout, toRect } from '../designSpec'
import type { DesignSpec } from '../designSpec'
import { isOfflineCity, searchOfflineCities } from '../offlineCitySearch'
import { resolveSampleMoment } from '../sampleLocationFallback'
import { suggestedObserverHeading } from '../skyImmersiveData'
import { wrapWorkshopHeading, clampWorkshopPitch } from '../skyWorkshopMath'
import { skyAboveArtworkAspect } from '../frameSkyBalance'
import type { AbovePhotoFitMode } from '../frameSkyBalance'
import { createCustomerPacket, downloadFile, orderPersonalization } from '../customerOrder'
import type { OrderPreferences } from '../customerOrder'
import './ExperiencePage.css'

type Stage = 'welcome'|'detecting'|'choice'|'refine'|'moment'|'calculating'|'preview'|'home'
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
    <div className="at-loading-orbit" aria-hidden="true"><span>✦</span><i/><i/><i/></div>
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
  const [room,setRoom]=useState<'warm'|'modern'|'gallery'>('warm')
  const [inscription,setInscription]=useState('')
  const [orderBusy,setOrderBusy]=useState(false)
  const [orderError,setOrderError]=useState('')
  const [preparedOrder,setPreparedOrder]=useState<{
    key:string;packet:Awaited<ReturnType<typeof createCustomerPacket>>
  }|null>(null)
  const [error,setError]=useState('')
  const [dragging,setDragging]=useState(false)
  const upload=useRef<HTMLInputElement>(null)
  const photoObject=useRef('')
  const overlayObject=useRef('')
  const cutoutObject=useRef('')
  const detectionVersion=useRef(0)
  const astronomyVersion=useRef(0)
  const lookupVersion=useRef(0)

  useEffect(()=>()=> {
    detectionVersion.current++
    astronomyVersion.current++
    if(photoObject.current) URL.revokeObjectURL(photoObject.current)
    if(overlayObject.current) URL.revokeObjectURL(overlayObject.current)
    if(cutoutObject.current) URL.revokeObjectURL(cutoutObject.current)
  },[])
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
      setProgress(100)
      setStage('choice')
    } catch(cause) {
      if(version!==detectionVersion.current)return
      setDetectorError(cause instanceof Error?cause.message:'The sky detector could not run.')
      setStage('choice')
    }
  }

  async function acceptPhoto(file?:File) {
    if(!file)return
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>MAX_PHOTO){
      setError('Choose a JPG, PNG or WebP photograph smaller than 10 MB.')
      return
    }
    detectionVersion.current++
    astronomyVersion.current++
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
    setPlacement('within')
    setError('')
    setSelected(null)
    setQuery('')
    setCandidates([])
    setDesign({...INITIAL_DESIGN_SPEC,stars:[],astronomy:null})
    setStage('detecting')
    try{
      const bitmap=await createImageBitmap(file)
      const width=bitmap.width, height=bitmap.height
      bitmap.close()
      if(photoObject.current!==url)return
      const ratio=Math.max(.35,Math.min(3,width/height))
      const {physicalArtwork,regions}=getFrameLayout('auto',ratio)
      setDimensions({width,height})
      setDesign(current=>({...current,framePresetId:'auto',photoAspectRatio:ratio,
        physicalArtwork,regions,photo:{...current.photo,assetId:'local-photo',
          fitMode:'contain',crop:FULL_PHOTO_CROP,positionMm:toRect(regions.engravingPhoto)},
        customText:{...current.customText,positionMm:toRect(regions.text)},stars:[],astronomy:null}))
      await runDetection(url)
    }catch(cause){
      if(photoObject.current!==url)return
      setError(cause instanceof Error?cause.message:'The photograph could not be opened.')
      setStage('welcome')
    }
  }

  function onDrop(event:DragEvent<HTMLElement>){
    event.preventDefault()
    setDragging(false)
    void acceptPhoto(event.dataTransfer.files[0])
  }
  function choosePlacement(){
    setError('')
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
      const moment=isOfflineCity(selected)
        ? resolveSampleMoment(date,unknownTime?null:time,unknownTime,selected)
        : await resolveMoment({date,time:unknownTime?null:time,
          exactTimeUnknown:unknownTime,locationQuery:query,location:selected})
      if(version!==astronomyVersion.current)return
      const calculated=await generateAstronomy(moment,design.skySettings,
        design.framePresetId,design.photoAspectRatio)
      if(version!==astronomyVersion.current)return
      setDesign(current=>({...current,moment,astronomy:calculated.calculation,stars:calculated.stars}))
      setHeading(wrapWorkshopHeading(suggestedObserverHeading(calculated.stars)))
      setPitch(18)
      setFov(105)
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
  const orderPreferences:OrderPreferences={
    layout:placement,heading,pitch,fov,skyHeight:skyPercent,
    photoFit,tone:skyTone,glow:atmosphericGlow,finish,inscription:inscription.trim(),
  }
  const orderKey=JSON.stringify({moment:design.moment,stars:design.stars,
    preferences:orderPreferences,photo:photo?.name,photoSize:photo?.size,cutoutUrl})
  const currentOrder=preparedOrder?.key===orderKey?preparedOrder.packet:null
  const etsyLink=(import.meta.env.VITE_ETSY_LISTING_URL as string|undefined)?.trim()
  const verifiedEtsyLink=etsyLink&&/^https:\/\/(www\.)?etsy\.com\/(listing|shop)\//.test(etsyLink)?etsyLink:null

  async function buildOrderPacket(){
    if(!photo)return
    const key=orderKey
    const preferences={...orderPreferences}
    setOrderBusy(true);setOrderError('')
    try{
      const packet=await createCustomerPacket({design,prefs:preferences,
        photo,photoUrl,cutoutUrl})
      setPreparedOrder({key,packet})
    }catch(cause){
      setOrderError(cause instanceof Error?cause.message:'Could not prepare your order files.')
    }finally{setOrderBusy(false)}
  }

  return <div className="at-shell">
    <div className="at-aurora" aria-hidden="true"/>
    <header className="at-header">
      <button type="button" className="at-wordmark" onClick={()=>{if(stage!=='welcome')setStage('welcome')}} aria-label="StarKeepsake home">
        <span className="at-logo-mark">✳</span><span>STAR<span>KEEPSAKE</span><small>THE NIGHT ATELIER</small></span>
      </button>
      <div className="at-header-note">YOUR STORY, HELD IN THE STARS <span>✦</span> PREVIEW STUDIO</div>
    </header>
    <nav className="at-steps" aria-label="Workshop progress">
      {STEPS.map((item,index)=><div key={item.key} className={index===atIndex?'is-current':index<atIndex?'is-done':''}
        aria-current={index===atIndex?'step':undefined}>
        <span>{index<atIndex?'✓':String(index+1).padStart(2,'0')}</span>{item.label}
      </div>)}
    </nav>
    <main className="at-main">
      {stage==='welcome'&&<section className="at-welcome at-appear">
        <div className="at-welcome-copy">
          <span className="at-kicker">WELCOME TO THE NIGHT ATELIER</span>
          <h1>Every moment<br/>has <em>its own sky.</em></h1>
          <p>A photograph to remember. The real stars from that very night.
            Together, we’ll make something worth keeping.</p>
          <div className="at-welcome-caption"><span>01 / BEGIN WITH A PHOTOGRAPH</span>
            <span>02 / WE’LL FIND YOUR SKY</span><span>03 / MAKE IT YOURS</span></div>
          <button type="button" className="at-primary" onClick={()=>upload.current?.click()}>
            Choose your photograph <span>↗</span></button>
          <small>JPG, PNG or WebP · up to 10 MB · Your image stays in your browser during sky detection.</small>
          {error&&<p className="at-error" role="alert">{error}</p>}
        </div>
        <div className={`at-welcome-art ${dragging?'is-dragging':''}`}
          onDragOver={event=>{event.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)} onDrop={onDrop}>
          <div className="at-orbit-ring" aria-hidden="true"><i/><i/></div>
          <div className="at-sample-frame" aria-hidden="true">
            <div className="at-sample-sky"><span>✦</span><span>·</span><span>✧</span><span>·</span></div>
            <div className="at-sample-landscape"/>
            <span className="at-sample-signature">A NIGHT TO REMEMBER</span>
          </div>
          <button type="button" onClick={()=>upload.current?.click()}>
            <span>＋</span> {dragging?'Drop your photograph here':'Or drop your image here'}
          </button>
        </div>
      </section>}

      {(stage==='detecting'||stage==='calculating')&&<section className="at-quiet-stage at-appear">
        <WizardLoader kind={stage} progress={progress}/>
      </section>}

      {stage==='choice'&&<section className="at-atelier-stage at-appear">
        <div className="at-stage-intro">
          <span className="at-kicker">CHAPTER 01 / YOUR PHOTOGRAPH</span>
          <h1>Where should<br/><em>your stars live?</em></h1>
          <p>We’ve examined your photograph for open sky. Now choose how it should meet the night you remember.</p>
        </div>
        <div className="at-choice-layout">
          <div className="at-detection-panel">
            <div className="at-panel-heading"><strong>YOUR PHOTOGRAPH</strong>
              <span>{detected&&detected.skyPercent>=3?'AI HORIZON FOUND':'REVIEW NEEDED'}</span></div>
            <div className="at-detection-image">
              {photoUrl&&<img src={showMask&&overlayUrl?overlayUrl:photoUrl}
                alt={showMask&&overlayUrl?'Cyan overlay shows the sky the AI found in your photograph':'Your original photograph'}/>}
              {detected&&detected.skyPercent>=3&&showMask&&<div className="at-mask-key"><i/> Blue marks the sky we found</div>}
            </div>
            <div className="at-detection-foot">
              <label><input type="checkbox" checked={showMask} onChange={event=>setShowMask(event.target.checked)}/>
                Show detected sky</label>
              <button type="button" onClick={()=>{if(photoUrl)void runDetection(photoUrl)}}>↻ Run detection again</button>
            </div>
            <p className={detected&&detected.skyPercent>=3?'at-detection-success':'at-detection-note'} role="status">
              {detectorError?'The AI detector was unavailable: '+detectorError+' You can still choose a separate sky or clean up manually.'
                :detected&&detected.skyPercent>=3?`Found approximately ${detected.skyPercent}% visible sky. You can fine-tune every edge next.`
                :'No clear sky was recognized. Choose a separate sky, or draw your own horizon in the editor.'}
            </p>
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
                  {isSearching?'Searching…':'Find places'}</button>
              </div>
              <p id="at-location-instructions" className="at-place-instructions">
                <span className={selected?'is-complete':''}>1. Search for your place</span>
                <span className={selected?'is-complete':candidates.length?'is-current':''}>
                  2. <strong>Select the matching location</strong> from the list
                </span>
              </p>
              {isSearching&&<p className="at-place-searching" role="status">
                Finding possible locations…
              </p>}
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

      {stage==='preview'&&<section className="at-preview-stage at-appear">
        <div className="at-stage-intro at-stage-intro--center">
          <span className="at-kicker">CHAPTER 04 / THE OBSERVATORY WORKSHOP</span>
          <h1>See the night<br/><em>from where you stood.</em></h1>
          <p>Turn toward north, east, south or west. Tilt your gaze. Your stars move with the perspective, just as they would above that place.</p>
        </div>
        <div className="at-preview-grid">
          <div className="at-preview-main">
            <SkyWorkshopPreview
              showroom={false} lightsOn={lightsOn} finish={finish}
              stars={design.stars} photoUrl={photoUrl} cutoutUrl={cutoutUrl}
              layout={placement}
              imageAspect={dimensions?dimensions.width/dimensions.height:1}
              heading={heading} pitch={pitch} fov={fov} skyHeight={skyPercent}
              photoFit={photoFit} glow={atmosphericGlow} tone={skyTone}
              maskAlpha={savedAlpha} maskDimensions={dimensions}
              showPerspectiveGuide={showPerspectiveGuide}
              onPerspectiveInteract={()=>setShowPerspectiveGuide(false)}
              onHeading={v=>{setShowPerspectiveGuide(false);setHeading(wrapWorkshopHeading(v))}}
              onPitch={v=>{setShowPerspectiveGuide(false);setPitch(clampWorkshopPitch(v))}}/>
            <div className="at-preview-caption">
              <div><span>THE NIGHT OF {date}</span><strong>{chosenName}</strong></div>
              <div><span>REAL HIPPARCOS STARS</span><strong>{design.stars.length} plotted in the calculated sky</strong></div>
            </div>
            {placement==='above'&&<div className="at-balance-box">
              <label>How much sky should frame your photograph? <strong>{skyPercent}%</strong>
                <input type="range" min="20" max="70" value={skyPercent}
                  onChange={e=>setSkyPercent(Number(e.target.value))}/></label>
              <div className="at-fit-list">{photoFits.map(item=><button
                key={item.id} type="button" className={photoFit===item.id?'is-selected':''}
                onClick={()=>setPhotoFit(item.id)}>{item.label}</button>)}</div>
            </div>}
          </div>
          <div className="at-preview-sidebar">
            <div className="at-side-heading"><span className="at-kicker">THE PERSPECTIVE</span><h2>Which way<br/><em>were you facing?</em></h2></div>
            <SkyWorkshopOrientation heading={heading} pitch={pitch} fov={fov}
              onHeading={v=>{setShowPerspectiveGuide(false);setHeading(wrapWorkshopHeading(v))}}
              onPitch={v=>{setShowPerspectiveGuide(false);setPitch(clampWorkshopPitch(v))}}
              onFov={v=>{setShowPerspectiveGuide(false);setFov(v)}}
              onReset={()=>{setShowPerspectiveGuide(false);setHeading(wrapWorkshopHeading(suggestedObserverHeading(design.stars)));setPitch(18);setFov(105)}}/>
            <div className="at-sky-atmosphere-controls">
              <span className="at-kicker">LIGHT & ATMOSPHERE</span>
              <label className="at-glow-choice"><input type="checkbox" checked={atmosphericGlow}
                onChange={event=>setAtmosphericGlow(event.target.checked)}/>
                Horizon glow (optional)</label>
              <fieldset className="at-tone-choice"><legend>Night sky tone</legend>
                {([['natural','Natural darkness'],['indigo','Midnight indigo'],['teal','Deep teal']] as const).map(([value,label])=>
                  <button key={value} type="button" aria-pressed={skyTone===value}
                    onClick={()=>setSkyTone(value)}>{label}</button>)}
              </fieldset>
              <small>The warm horizon glow follows your viewing angle and disappears when disabled. Stars remain calculated from the same place and moment.</small>
            </div>
            <div className="at-workshop-actions">
              <button type="button" onClick={editMoment}>✎ Change date or location</button>
              <button type="button" onClick={()=>setStage('choice')}>✎ Change photo composition</button>
              {placement==='within'&&<button type="button" onClick={()=>setStage('refine')}>✎ Refine the horizon again</button>}
              <button type="button" onClick={()=>upload.current?.click()}>＋ Choose another photograph</button>
            </div>
          </div>
        </div>
        <div className="at-finish-chapter">
          <div>
            <span className="at-kicker">ONE LAST STEP</span>
            <strong>Picture your creation at home.</strong>
            <p>Your sky is ready. Step into the showroom, explore the frame
              finishes and see how your stars could illuminate a room.</p>
          </div>
          <button type="button" className="at-primary"
            onClick={()=>{setStage('home');window.scrollTo({top:0,behavior:'smooth'})}}>
            See my keepsake in a room <span>↗</span>
          </button>
        </div>
        <p className="at-science-caveat">The star positions are calculated from your location, date and local time. The
          perspective is adjustable but not automatically calibrated to your photograph’s camera direction or lens.
          This is a digital artistic preview, not a manufacturing-ready file. StarKeepsake is not affiliated with NASA.</p>
      </section>}

      {stage==='home'&&<section className="at-home-stage at-appear">
        <div className="at-home-heading">
          <span className="at-kicker">CHAPTER 05 / BRING YOUR NIGHT HOME</span>
          <h1>A memory made<br/><em>to live with.</em></h1>
          <p>Imagine your moment on the wall, gently illuminated after dark.
            Find the finish that feels like you, and see it in a space that feels like home.</p>
        </div>
        <div className="at-home-layout">
          <div className="at-home-left">
            <HomeShowroom room={room}
              imageAspect={placement==='above'
                ? skyAboveArtworkAspect(dimensions?dimensions.width/dimensions.height:1,skyPercent)
                :dimensions?dimensions.width/dimensions.height:1}>
              <SkyWorkshopPreview
                showroom={true} lightsOn={lightsOn} finish={finish}
                stars={design.stars} photoUrl={photoUrl} cutoutUrl={cutoutUrl}
                layout={placement}
                imageAspect={dimensions?dimensions.width/dimensions.height:1}
                heading={heading} pitch={pitch} fov={fov} skyHeight={skyPercent}
                photoFit={photoFit} glow={atmosphericGlow} tone={skyTone}
                maskAlpha={savedAlpha} maskDimensions={dimensions}
                showPerspectiveGuide={false}
                onPerspectiveInteract={()=>{}}
                onHeading={()=>{}} onPitch={()=>{}}/>
            </HomeShowroom>
            <div className="at-home-customize">
              <fieldset className="at-home-choice">
                <legend><span>01</span> Choose your room</legend>
                <div className="at-home-choice-list">{ROOM_OPTIONS.map(choice=>
                  <button type="button" key={choice.id} aria-pressed={room===choice.id}
                    onClick={()=>setRoom(choice.id)}>
                    <span aria-hidden="true">{choice.symbol}</span>
                    {choice.label}
                  </button>)}</div>
              </fieldset>
              <fieldset className="at-home-choice">
                <legend><span>02</span> Find your frame finish</legend>
                <div className="at-home-wood-options">{WOOD_OPTIONS.map(choice=>
                  <button type="button" key={choice.id} aria-pressed={finish===choice.id}
                    onClick={()=>setFinish(choice.id)}>
                    <i className={`at-home-wood-swatch at-swatch-${choice.id}`} aria-hidden="true"/>
                    <strong>{choice.label}</strong>
                  </button>)}</div>
                <small>Finish colors are digital samples, not finalized materials or stock.</small>
              </fieldset>
              <div className="at-home-lighting">
                <div><span className="at-home-control-kicker">03 / LIGHT THE STARS</span>
                  <strong>See it come alive after dark.</strong></div>
                <button type="button" aria-pressed={lightsOn}
                  onClick={()=>setLightsOn(value=>!value)}>
                  {lightsOn?'✦ Turn the stars off':'✧ Illuminate the stars'}
                </button>
              </div>
            </div>
            <p className="at-home-render-note">Your actual customized frame,
              staged over licensed interior photography for inspiration.
              This is not a photo of a manufactured product, an exact-scale
              placement, or camera-based AR. Final wood, lighting and size
              depend on a tested physical prototype.</p>
          </div>
          <aside className="at-home-right">
            <div className="at-home-spec">
              <span className="at-kicker">MADE FROM YOUR MOMENT</span>
              <h2>Your night, <em>framed.</em></h2>
              <div className="at-home-facts">
                <div><span>THE MOMENT</span><strong>{date}{unknownTime?' · Time unknown':` · ${time}`}</strong></div>
                <div><span>THE PLACE</span><strong>{chosenName}</strong></div>
                <div><span>YOUR VIEW</span><strong>{Math.round(heading)}° direction · {Math.round(pitch)}° upward</strong></div>
                <div><span>FRAME CONCEPT</span>
                  <strong>{WOOD_OPTIONS.find(choice=>choice.id===finish)?.label}
                    {' · '}{design.framePresetId==='auto'?'Custom proportions':design.framePresetId+' in'}</strong></div>
              </div>
              <button type="button" className="at-home-back"
                onClick={()=>{setStage('preview');window.scrollTo({top:0,behavior:'smooth'})}}>
                ← Adjust my sky and perspective
              </button>
            </div>
            <div className="at-customer-order">
              <span className="at-kicker">THE FINISHING TOUCH / YOUR KEEPSAKE</span>
              <h2>Make it <em>yours.</em></h2>
              <p>Your finished design can become a one-of-a-kind keepsake.
                Prepare the original photo, polished foreground and your personalized
                design sheet for an eventual Etsy order.</p>
              <label htmlFor="at-order-inscription">A short inscription (optional)</label>
              <input id="at-order-inscription" type="text" maxLength={65}
                value={inscription} placeholder="e.g. The night our story began"
                onChange={event=>setInscription(event.target.value)}/>
              <button type="button" className="at-primary at-wide" disabled={orderBusy}
                onClick={()=>void buildOrderPacket()}>
                {orderBusy?'Preparing your keepsake…':'Get this keepsake'} <span>✦</span>
              </button>
              {orderError&&<p role="alert" className="at-error">{orderError}</p>}
              {currentOrder&&<div className="at-ready-packet" role="status">
                <div><strong>Design files ready</strong>
                  <span className="at-order-reference">{currentOrder.manifest.reference}</span>
                  <small>This is a file-matching reference, not a paid order.</small>
                </div>
                <button type="button" onClick={()=>downloadFile(currentOrder.zip,
                  currentOrder.manifest.reference+'-maker-packet.zip')}>
                  ↓ Download complete maker packet</button>
                <button type="button" onClick={()=>downloadFile(currentOrder.sheet,'order-sheet.png')}>
                  ↓ Download Etsy order sheet (PNG)</button>
                {currentOrder.prepared&&<button type="button"
                  onClick={()=>downloadFile(currentOrder.prepared!,'prepared-foreground.png')}>
                  ↓ Download polished foreground (PNG)</button>}
                <button type="button" onClick={()=>{
                  void navigator.clipboard.writeText(orderPersonalization(currentOrder.manifest))
                    .catch(()=>setOrderError('Copy failed. Download the order sheet instead.'))
                }}>Copy Etsy personalization details</button>
                {verifiedEtsyLink?<a className="at-etsy-checkout" href={verifiedEtsyLink}
                  target="_blank" rel="noopener noreferrer">
                  Continue to Etsy checkout ↗</a>
                  :<p className="at-checkout-pending">
                    Our Etsy shop is getting ready. You can save your custom design
                    files now, but ordering and payment are not available yet.</p>}
                <small>When our Etsy listing opens, use its personalization fields to
                  send this design reference and your artwork. Your order is only placed
                  after Etsy checkout is completed.</small>
              </div>}
            </div>
          </aside>
        </div>
      </section>}
    </main>
    <footer className="at-footer"><span>✳ STARKEEPSAKE</span><span>THE BEAUTY OF A NIGHT, HELD FOREVER.</span><span>PERSONAL SKY ATELIER · PREVIEW</span></footer>
    {stage==='refine'&&photo&&<SkyMaskEditor key={photoUrl} file={photo}
      initialMask={savedAlpha} detectedMask={detected}
      showPolishGuide={showPolishGuide} onDismissPolishGuide={()=>setShowPolishGuide(false)}
      onApply={saveMask} onClose={()=>setStage('choice')}/>}
    <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp"
      className="at-hidden-file" aria-label="Upload your photograph"
      onChange={event=>{void acceptPhoto(event.currentTarget.files?.[0]);event.currentTarget.value=''}}/>
  </div>
}
