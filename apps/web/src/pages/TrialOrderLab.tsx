import {useState} from 'react'
import {createCustomerPacket,downloadFile} from '../customerOrder'
import type {OrderPreferences} from '../orderManifest'
import {PRINT_VARIANTS} from '../manufacturingPrint'
import {assessPhotoPrintQuality} from '../photoPrintQuality'
import {buildManufacturingJobPlan} from '../manufacturingJobPlan'
import {generateAstronomy} from '../api'
import {INITIAL_DESIGN_SPEC} from '../designSpec'
import type {DesignSpec} from '../designSpec'
import {makePhysicalView} from '../physicalStarView'
import {selectVisiblePhysicalStars} from '../physicalStarSelection'
import type {ViewedCandidate} from '../physicalStarSelection'
import {SAMPLE_LOCATIONS,resolveSampleMoment} from '../sampleLocationFallback'
import {suggestedObserverHeading} from '../skyImmersiveData'
import {etsyListingForFinish} from '../etsyCheckout'
import {createTrialPhoto,createTrialForeground,fallbackTrialStars,
  fallbackTrialCalculation,TRIAL_DATE,TRIAL_TIME,TRIAL_REFERENCE} from '../trialOrderFixture'
import './TrialOrderLab.css'

type Verdict='pass'|'fail'|'note'
type TrialCheck={id:string;title:string;verdict:Verdict;description:string}
type Packet=Awaited<ReturnType<typeof createCustomerPacket>>
type Layout='above'|'within'
const API=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
const steps=[
  {id:'customer',title:'Customer photo and sky',
    text:'Confirm the sample photo is loaded, the location/date are prefilled, and the sky appears. In Chapter 05 verify that the LED count changes if you edit selections.'},
  {id:'save',title:'Save and reopen',
    text:'In Chapter 05 explicitly save the trial design, copy the private reopening link, and reopen it. This creates a real SAVED_UNPAID test design but NOT an Etsy purchase.'},
  {id:'etsy',title:'Etsy handoff',
    text:'Prepare the Etsy packet, check that the SK Design ID is required in the live Etsy listing and that frame finish and actual checkout price agree. STOP before payment unless you deliberately want a real charged order.'},
  {id:'admin',title:'Owner production screen',
    text:'Open the admin dashboard using your real owner key. A simulated trial order must NOT appear. For real paid-order validation, use a deliberately purchased test item and Sync Etsy.'},
  {id:'files',title:'Physical proof and parts',
    text:'Download and inspect all three supplier print files and guides. Confirm image sharpness, safe margin, star placement, and per-order parts. A print/lab/electronics proof is still required.'},
] as const
const listing=etsyListingForFinish('walnut',{
  walnut:import.meta.env.VITE_ETSY_LISTING_WALNUT_URL as string|undefined,
  shared:import.meta.env.VITE_ETSY_LISTING_URL as string|undefined,
})

async function inspectPng(file:Blob){
  const image=await createImageBitmap(file)
  try{return {width:image.width,height:image.height}}
  finally{image.close()}
}

/** READ-ONLY trial runner: never saves a design, impersonates an Etsy order, or makes a purchase. */
export function TrialOrderLab(){
  const [layout,setLayout]=useState<Layout>('above')
  const [running,setRunning]=useState(false)
  const [progress,setProgress]=useState('')
  const [checks,setChecks]=useState<TrialCheck[]>([])
  const [packet,setPacket]=useState<Packet|null>(null)
  const [sample,setSample]=useState<File|null>(null)
  const [physicalCount,setPhysicalCount]=useState<number|null>(null)
  const [liveSky,setLiveSky]=useState(false)
  const [manual,setManual]=useState<Record<string,boolean>>({})
  const [startedAt,setStartedAt]=useState('')
  function mark(id:string,title:string,verdict:Verdict,description:string){
    setChecks(current=>[...current.filter(x=>x.id!==id),{id,title,verdict,description}])
  }
  async function run(){
    if(running)return
    setRunning(true);setProgress('Preparing synthetic photo')
    setPacket(null);setSample(null);setChecks([]);setPhysicalCount(null);setLiveSky(false)
    setStartedAt(new Date().toISOString())
    let photoUrl='',foregroundUrl=''
    try{
      const photo=await createTrialPhoto()
      setSample(photo)
      const dims=await inspectPng(photo)
      const quality=assessPhotoPrintQuality({
        sourceWidth:dims.width,sourceHeight:dims.height,
        artworkWidthMm:279.4,artworkHeightMm:355.6,
        layout,skyHeight:42,photoFit:'fit'
      })
      const hiRes=assessPhotoPrintQuality({sourceWidth:6400,sourceHeight:4800,
        artworkWidthMm:279.4,artworkHeightMm:355.6,
        layout:'above',skyHeight:42,photoFit:'fit'})
      const lowRes=assessPhotoPrintQuality({sourceWidth:500,sourceHeight:400,
        artworkWidthMm:279.4,artworkHeightMm:355.6,
        layout:'above',skyHeight:42,photoFit:'fit'})
      const cropped=assessPhotoPrintQuality({sourceWidth:1800,sourceHeight:1200,
        artworkWidthMm:279.4,artworkHeightMm:355.6,
        layout:'above',skyHeight:42,photoFit:'center-crop'})
      const scenariosPass=hiRes.status==='excellent'&&lowRes.status==='review'&&
        lowRes.needsOwnerReview&&cropped.effectivePpi<hiRes.effectivePpi&&
        quality.artworkIs11x14
      mark('photo','Synthetic source photo',
        dims.width===3600&&dims.height===2700&&scenariosPass?'pass':'fail',
        dims.width+' × '+dims.height+' px, '+quality.effectivePpi+
        ' effective PPI. High-resolution, low-resolution and cropped examples: '+
        (scenariosPass?'tier checks passed':'quality tier mismatch')+
        '. '+(quality.needsOwnerReview?'Manual owner approval required for this layout.':
          'Physical print proof still required.'))
      photoUrl=URL.createObjectURL(photo)
      setProgress('Requesting real Chicago night sky from astronomy API')
      const moment=resolveSampleMoment(TRIAL_DATE,TRIAL_TIME,false,SAMPLE_LOCATIONS[0])
      let stars:DesignSpec['stars']=[],calculation:NonNullable<DesignSpec['astronomy']>
      let genuine=false
      try{
        const sky=await generateAstronomy(moment,INITIAL_DESIGN_SPEC.skySettings,'11x14',4/3)
        stars=sky.displayStars??sky.stars
        calculation=sky.calculation
        if(stars.length===0)throw Error('Real astronomy returned no visible stars.')
        genuine=true
        mark('sky','Live astronomy API','pass',
          'Actual calculation for '+TRIAL_DATE+' at '+TRIAL_TIME+' in Chicago; '+
          stars.length+' digital star coordinates returned.')
      }catch(error){
        stars=fallbackTrialStars()
        calculation=fallbackTrialCalculation(moment.utcDateTime??'2024-07-05T02:00:00Z')
        mark('sky','Live astronomy API','fail',
          (error instanceof Error?error.message:'API failed')+
          '. Using a clearly labeled SYNTHETIC fallback only for subsequent print tests.')
      }
      setLiveSky(genuine)
      const heading=genuine?suggestedObserverHeading(stars):180
      const prefs:OrderPreferences={layout,heading,pitch:18,fov:105,skyHeight:42,
        photoFit:'fit',tone:'natural',glow:true,finish:'walnut',
        inscription:'SYNTHETIC TRIAL — NOT A CUSTOMER ORDER'}
      let design:DesignSpec={...INITIAL_DESIGN_SPEC,designId:TRIAL_REFERENCE,
        framePresetId:'11x14',photoAspectRatio:4/3,moment,astronomy:calculation,
        stars,displayStars:stars,
        photo:{...INITIAL_DESIGN_SPEC.photo,assetId:'synthetic-trial-photo'}}
      let physical=makePhysicalView(design,{heading,pitch:18,fov:105,
        layout,skyHeight:42,imageAspect:4/3,maskAlpha:null,maskDimensions:null,
        photoFit:'fit'})
      if(!physical.physicalStars.length){
        mark('real-view','Real sky physical-light preview','fail',
          'This perspective produced zero printable LEDs. Keeping this failure visible; using an offline star fixture to test the export format.')
        design={...design,stars:fallbackTrialStars(),displayStars:fallbackTrialStars()}
        physical=makePhysicalView(design,{heading:180,pitch:18,fov:105,
          layout,skyHeight:42,imageAspect:4/3,maskAlpha:null,maskDimensions:null,photoFit:'fit'})
        prefs.heading=180
      }else mark('real-view','Physical-light view','pass',
        physical.physicalStars.length+' lights selected from '+physical.candidates.length+
        ' print-safe candidates out of '+physical.visibleDigitalCount+' digital stars.')
      design={...design,physicalStars:physical.physicalStars,
        physicalSelection:physical.physicalSelection}
      const makerPlan=buildManufacturingJobPlan(design,prefs)
      mark('maker-bom','Design-specific manufacturing parts and star mapping',
        makerPlan.physicalCount===physical.physicalStars.length &&
        makerPlan.parts.find(x=>x.key==='star_led')?.quantity===makerPlan.physicalCount &&
        makerPlan.driverCount===Math.ceil(makerPlan.physicalCount/24)&&
        makerPlan.connectorGroupCount===Math.ceil(makerPlan.physicalCount/12)?'pass':'fail',
        makerPlan.physicalCount+' star LEDs, '+makerPlan.driverCount+
        ' TLC5947 driver(s), '+makerPlan.connectorGroupCount+
        ' harness connector groups; candidate plan is on physical approval HOLD.')
      setPhysicalCount(physical.physicalStars.length)
      const fixtures:ViewedCandidate[]=Array.from({length:40},(_,i)=>({
        star:{hipparcosId:100000+i,xMm:12+(i%8)*28,yMm:14+Math.floor(i/8)*28,
          altitudeDeg:15+i%6*7,azimuthDeg:20+i*7,magnitude:.5+(i%9)*.54,
          holeSizeMm:.7,ledIndex:i},
        printXMm:12+(i%8)*28,printYMm:14+Math.floor(i/8)*28,
      }))
      const under=selectVisiblePhysicalStars(fixtures.slice(0,12),24,4.5)
      const over=selectVisiblePhysicalStars(fixtures,24,4.5)
      const single=selectVisiblePhysicalStars(fixtures,24,4.5,{
        mode:'manual',selectedHipIds:[fixtures[0].star.hipparcosId]})
      const restored=selectVisiblePhysicalStars(fixtures,24,4.5)
      const starPass=under.physicalStars.length===12&&over.physicalStars.length===24&&
        single.physicalStars.length===1&&restored.physicalStars.length===24
      mark('selection','Automatic, manual and reset LED rules',starPass?'pass':'fail',
        '12 eligible → '+under.physicalStars.length+
        '; 40 eligible → '+over.physicalStars.length+
        '; manually 1 → '+single.physicalStars.length+
        '; restored → '+restored.physicalStars.length+'.')
      if(!starPass)throw Error('The star selection unit scenario did not pass.')
      if(layout==='within'){
        setProgress('Preparing synthetic cutout for within-photo mode')
        const foreground=await createTrialForeground(photo)
        foregroundUrl=URL.createObjectURL(foreground)
      }
      setProgress('Rendering the three full-resolution 300-DPI print files')
      const exportResult=await createCustomerPacket({
        design,prefs,photo,photoUrl,cutoutUrl:foregroundUrl,
        savedDesignId:TRIAL_REFERENCE,
      })
      setPacket(exportResult)
      const verified=await Promise.all(PRINT_VARIANTS.map(async variant=>{
        const actual=await inspectPng(exportResult.printVariants[variant.id])
        const declared=exportResult.manifest.manufacturing?.printVariants?.find(
          s=>s.id===variant.id)?.spec.documentPixels
        return {variant,actual,declared,ok:actual.width===declared?.width&&
          actual.height===declared?.height}
      }))
      mark('prints','All three real print exporters',
        verified.every(v=>v.ok)?'pass':'fail',
        verified.map(x=>x.variant.label+': '+x.actual.width+' × '+
          x.actual.height+' px ('+(x.ok?'verified':'MISMATCH')+')').join(' · '))
      const packetQuality=exportResult.manifest.manufacturing?.photoQuality
      mark('print-quality-report','Manufacturing preflight in ZIP manifest',
        packetQuality?.version==='photo-print-preflight-v1'&&
        packetQuality.artworkIs11x14&&
        packetQuality.effectivePpi===quality.effectivePpi?'pass':'fail',
        'Recomputed source effective PPI: '+
        (packetQuality?.effectivePpi??'missing')+
        '; owner print hold: '+(packetQuality?.needsOwnerReview??'unknown')+
        '. photo-quality-report.json travels with manufacturing packet.')
      const names=exportResult.manifest.expectedFiles
      const packetPass=names.every(name=>new Uint8Array(
        new TextEncoder().encode(name)).length>0)&&
        exportResult.manifest.status==='UNPAID_PREVIEW'&&
        exportResult.manifest.reference===TRIAL_REFERENCE&&
        names.every(name=>name!=='print-artwork-with-bleed.png')&&
        exportResult.zip.size>0
      mark('packet','Unpaid maker ZIP and metadata',packetPass?'pass':'fail',
        exportResult.zip.size.toLocaleString()+
        ' ZIP bytes; contains design manifest, original photo, '+
        (layout==='within'?'prepared foreground, ':'')+
        'three prints, matching specs and trim guides. TEST ONLY.')
      setProgress('Checking production API denies anonymous admin access')
      try{
        const response=await fetch(API+'/api/admin/production/orders',{cache:'no-store'})
        mark('admin-gate','Owner-only API security',response.status===401?'pass':'fail',
          'Anonymous read of production order endpoint returned HTTP '+response.status+
          ' (expected 401). No private order data was requested with a key.')
      }catch(error){
        mark('admin-gate','Owner-only API security','fail',
          'Could not reach the admin endpoint: '+
          (error instanceof Error?error.message:String(error)))
      }
      mark('payment','Payment and job ingestion','note',
        'No Etsy purchase was created. A simulated trial receipt is shown below only in this browser; live paid sync and owner download require a deliberately paid order.')
      setProgress('Trial finished — review the results and optional manual steps')
    }catch(error){
      mark('runner','Automated trial','fail',error instanceof Error?error.message:String(error))
      setProgress('Trial stopped. Read the failed check, then download the report.')
    }finally{
      if(photoUrl)URL.revokeObjectURL(photoUrl)
      if(foregroundUrl)URL.revokeObjectURL(foregroundUrl)
      setRunning(false)
    }
  }
  function report(){
    return {kind:'STARKEEPSAKE_SYNTHETIC_TRIAL_V1',isRealEtsyOrder:false,
      startedAt,generatedAt:new Date().toISOString(),scenario:layout,
      reference:TRIAL_REFERENCE,liveAstronomyVerified:liveSky,
      selectedPhysicalStars:physicalCount,
      checks,manualSteps:manual,
      links:{customer:window.location.origin+'/?trial=1',
        admin:window.location.origin+'/admin/production'},
      disclosures:['No real Etsy payment or order record created',
        'No database writes by automated runner',
        'Browser rendering is not an approved physical-print proof',
        'Quality and selected-N material BOM still require final validation']}
  }
  function downloadReport(){
    downloadFile(new Blob([JSON.stringify(report(),null,2)],
      {type:'application/json'}),'starkeepsake-trial-results.json')
  }
  const completed=checks.filter(x=>x.verdict==='pass').length
  const failed=checks.filter(x=>x.verdict==='fail').length
  const checked=steps.filter(x=>manual[x.id]).length
  return <main className="tol-page">
    <div className="tol-shell">
      <header className="tol-header">
        <a href="/" className="tol-back">← StarKeepsake workshop</a>
        <span className="tol-eyebrow">STARKEEPSAKE / TEST LAB 01</span>
        <h1>Trial order <em>flight check.</em></h1>
        <p>One prepared photograph, one known night sky, and every print format —
          without writing fake Etsy receipts, charging a card, or placing supplier orders.</p>
        <div className="tol-alert" role="note"><strong>SIMULATION · NO PAYMENT</strong>
          This lab does not create a real paid Etsy order. Live payment confirmation
          and paid-order download still need a separate authorized test purchase.</div>
      </header>
      <section className="tol-card" aria-label="Start trial">
        <div className="tol-card-head"><div><span>01 / AUTOMATED CHECK</span>
          <h2>Generate a realistic sample package</h2></div>
          <span className="tol-tag">Read-only outside browser</span></div>
        <p>We'll generate synthetic 3600 × 2700 artwork, calculate the night sky,
          exercise automatic/manual star counts, render all three print sizes,
          inspect PNG dimensions, and check the anonymous admin-access gate.</p>
        <div className="tol-controls">
          <label>Test composition
            <select value={layout} onChange={event=>setLayout(event.target.value as Layout)}
              disabled={running}>
              <option value="above">Sky above photograph (fastest)</option>
              <option value="within">Stars within photograph (synthetic cutout)</option>
            </select>
          </label>
          <button type="button" className="tol-primary" onClick={()=>void run()} disabled={running}>
            {running?'Running automated checks…':'▶ Run automated trial'}
          </button>
        </div>
        {progress&&<p className="tol-progress" role="status">{progress}</p>}
        {checks.length>0&&<>
          <div className="tol-score"><strong>{completed} passed</strong>
            <span>{failed} failed</span><span>{checks.length-completed-failed} notes</span></div>
          <div className="tol-checks">{checks.map(check=><div key={check.id}
            className={'tol-result tol-'+check.verdict}>
            <span aria-hidden="true">{check.verdict==='pass'?'✓':check.verdict==='fail'?'!':'i'}</span>
            <div><strong>{check.title}</strong><p>{check.description}</p></div>
          </div>)}</div>
          <button type="button" className="tol-secondary" onClick={downloadReport}>
            ↓ Download test report (JSON)</button>
        </>}
      </section>
      {packet&&<section className="tol-card" aria-label="Simulated production order">
        <div className="tol-card-head"><div><span>02 / SIMULATED OWNER ORDER</span>
          <h2>Mock paid-order preview</h2></div><span className="tol-tag">NOT in live Etsy</span></div>
        <div className="tol-order-preview">
          <div><strong>TRIAL #LOCAL-001</strong><small>{TRIAL_REFERENCE}</small></div>
          <div><strong>Demo walnut 11 × 14</strong><small>{physicalCount} candidate LED light assemblies</small></div>
          <div><strong>SIMULATED ONLY</strong><small>No real receipt, payment or stock allocation</small></div>
        </div>
        <p>This is what the owner would need from a paid matched order. The
          files below are real outputs of StarKeepsake's print renderer, generated
          from synthetic trial input.</p>
        <div className="tol-exports">
          {PRINT_VARIANTS.map(v=><article key={v.id}>
            <strong>{v.label}</strong>
            <span>{packet.manifest.manufacturing?.printVariants?.find(x=>x.id===v.id)?.spec.documentSizeIn.width}
              {' × '}{packet.manifest.manufacturing?.printVariants?.find(x=>x.id===v.id)?.spec.documentSizeIn.height} in</span>
            <button type="button" onClick={()=>downloadFile(packet.printVariants[v.id],
              'TRIAL-'+v.artwork)}>↓ Download print PNG</button>
          </article>)}
        </div>
        <div className="tol-actions">
          <button type="button" onClick={()=>downloadFile(packet.zip,
            'STARKEEPSAKE-SYNTHETIC-TRIAL-MAKER-PACKET.zip')}>↓ Full maker packet ZIP</button>
          {sample&&<button type="button" onClick={()=>downloadFile(sample,sample.name)}>
            ↓ Sample source photograph</button>}
          <button type="button" onClick={()=>downloadFile(packet.sheet,
            'TRIAL-order-sheet.png')}>↓ Order-sheet preview</button>
        </div>
        <p className="tol-warning">Supplier parts and manufacturing authorization are NOT
          automatically approved. The {physicalCount} selected lights shown above determine
          an illustrative quantity, not a certified bill of materials or a drill-ready map.</p>
      </section>}
      <section className="tol-card" aria-label="Live user acceptance checklist">
        <div className="tol-card-head"><div><span>03 / REAL WEBSITE WALKTHROUGH</span>
          <h2>Test the actual customer and admin experiences</h2></div>
          <span className="tol-tag">{checked} / {steps.length} reviewed</span></div>
        <p>These checks require your eyes or an intentional Save click.
          On a fresh workshop, the trial link automatically loads the synthetic
          photograph and example date/place without cluttering the landing page.
          An existing local draft is preserved instead of being overwritten.</p>
        <div className="tol-links">
          <a href="/?trial=1" target="_blank" rel="noopener noreferrer">
            ↗ Open real customer workshop with automatic sample</a>
          <a href="/admin/production" target="_blank" rel="noopener noreferrer">
            ↗ Open real owner Production Studio</a>
          {listing&&<a href={listing.url} target="_blank" rel="noopener noreferrer">
            ↗ Inspect real Etsy listing (do not buy unless intended)</a>}
        </div>
        <div className="tol-manual">{steps.map((step,i)=><label key={step.id}>
          <input type="checkbox" checked={Boolean(manual[step.id])}
            onChange={event=>setManual(v=>({...v,[step.id]:event.target.checked}))}/>
          <div><strong>{i+1}. {step.title}</strong><p>{step.text}</p></div>
        </label>)}</div>
        <p className="tol-warning">For the REAL paid-order test, the owner must
          intentionally place and pay for an actual Etsy order, enter the
          server-issued Design ID, sync Etsy, then open its owner manufacturing
          files. Do not use {TRIAL_REFERENCE} as Etsy personalization.</p>
      </section>
      <footer className="tol-footer">No customer records, Etsy payments, supplier purchases,
        or private admin keys are created by the automated trial.</footer>
    </div>
  </main>
}
