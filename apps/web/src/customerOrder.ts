import type { DesignSpec } from './designSpec'
import type { AbovePhotoFitMode } from './frameSkyBalance'
import { projectObserverStar } from './skyImmersiveData'
import { observerPointInPanel } from './skyWorkshopMath'
import { orderReference, makeOrderManifest, zipFiles } from './orderManifest'
import type { OrderManifest, OrderPreferences } from './orderManifest'
import type { FrameQuote } from './storefrontPricing'
import { printSpecification,trimSafeGuideSvg,embedPngDpi,PRINT_VARIANTS,DEFAULT_PRINT_SETTINGS } from './manufacturingPrint'
import type {PrintSpecification,PrintVariantId} from './manufacturingPrint'
import {assessPhotoPrintQuality,samplePhotoVisualMetrics} from './photoPrintQuality'
import {countPhysicalLeds,assertMakerStarParity} from './physicalStarParity'
import {buildManufacturingJobPlan,makerChecklistJson,makerStarMapCsv,
  makerPartsCsv,makerDrillTemplateSvg} from './manufacturingJobPlan'
import type {PhotoVisualMetrics} from './photoPrintQuality'
export type { OrderManifest, OrderPreferences } from './orderManifest'
export { orderPersonalization } from './orderManifest'
const encoder=new TextEncoder()
export function downloadFile(blob:Blob,name:string){
  const url=URL.createObjectURL(blob)
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name
  document.body.append(anchor);anchor.click();anchor.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1400)
}
const readImage=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image)
  image.onerror=()=>reject(Error('Could not render your photo.'))
  image.src=url
})
const png=(canvas:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>{
  canvas.toBlob(b=>b?resolve(b):reject(Error('Could not export order sheet.')),'image/png')
})
function placePhoto(ctx:CanvasRenderingContext2D,img:HTMLImageElement,
  x:number,y:number,w:number,h:number,fit:AbovePhotoFitMode){
  const ratio=img.naturalWidth/img.naturalHeight
  if(fit==='stretch'){ctx.drawImage(img,x,y,w,h);return}
  if(fit==='fit'){
    const fw=Math.min(w,h*ratio),fh=fw/ratio
    ctx.drawImage(img,x+(w-fw)/2,y+(h-fh)/2,fw,fh);return
  }
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight)
  const sw=w/scale,sh=h/scale
  const sx=(img.naturalWidth-sw)/2
  const sy=fit==='top-crop'?img.naturalHeight-sh:fit==='bottom-crop'?0:(img.naturalHeight-sh)/2
  ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h)
}
async function createOrderSheet(manifest:OrderManifest,photoUrl:string,
  preparedUrl:string):Promise<Blob>{
  const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1900
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unsupported.')
  ctx.fillStyle='#071723';ctx.fillRect(0,0,1400,1900)
  ctx.fillStyle='#f1deb9';ctx.font='44px Georgia'
  ctx.fillText('STARKEEPSAKE',90,95)
  ctx.font='22px sans-serif';ctx.fillStyle='#b9cfd0'
  ctx.fillText('YOUR DESIGN CARD  /  ETSY REFERENCE',90,142)
  ctx.font='30px Georgia';ctx.fillStyle='#efd3a0'
  ctx.fillText('DESIGN ID  '+manifest.reference,90,203)
  const {design,preferences:p}=manifest
  const x=112,y=270,w=1176,h=1220
  ctx.fillStyle='#684831';ctx.fillRect(x-17,y-17,w+34,h+34)
  ctx.fillStyle='#ca9e6e';ctx.fillRect(x-8,y-8,w+16,h+16)
  const skyHeight=p.layout==='within'?h:h*p.skyHeight/100
  const palette=p.tone==='teal'?['#081924','#194a5b']:p.tone==='indigo'?
    ['#050e25','#1b2850']:['#040c1d','#213f57']
  const grad=ctx.createLinearGradient(0,y,0,y+skyHeight)
  grad.addColorStop(0,palette[0]);grad.addColorStop(1,palette[1])
  ctx.fillStyle=grad;ctx.fillRect(x,y,w,skyHeight)
  // Order sheet is illustrative; catalogue positions are camera-projected.
  const aspect=p.layout==='within'?w/h:w/skyHeight
  const illuminatedHip=new Set((design.physicalStars??[]).map(star=>star.hipparcosId))
  for(const star of design.stars){
    const projected=projectObserverStar(star.azimuthDeg,star.altitudeDeg,p.heading,p.pitch,p.fov)
    if(!projected.inFront)continue
    const point=observerPointInPanel(projected.x,projected.y,aspect)
    if(!point.inside)continue
    const px=x+point.x*w,py=y+point.y*skyHeight
    const lit=illuminatedHip.has(star.hipparcosId)
    const radius=Math.max(1,4.4-star.magnitude*.55)*(lit?1.3:1)
    ctx.beginPath();ctx.fillStyle=lit?'#fff1cd':'rgba(255,247,227,.75)'
    ctx.shadowBlur=radius*(lit?8:6);ctx.shadowColor='#eff2ff'
    ctx.arc(px,py,radius,0,2*Math.PI);ctx.fill()
  }
  ctx.shadowBlur=0
  // Match the preview layer order: star field BEHIND the preserved foreground.
  if(p.layout==='within'){
    ctx.drawImage(await readImage(preparedUrl),x,y,w,h)
  }else{
    ctx.fillStyle='#0b1929';ctx.fillRect(x,y+skyHeight,w,h-skyHeight)
    placePhoto(ctx,await readImage(photoUrl),x,y+skyHeight,w,h-skyHeight,p.photoFit)
  }
  ctx.fillStyle='#f0d5a6';ctx.font='27px Georgia'
  ctx.fillText((p.inscription||'A night to remember').slice(0,65),90,1575)
  ctx.fillStyle='#c4d3d4';ctx.font='21px sans-serif'
  ctx.fillText('Date '+design.moment.date+'  ·  Time '+(design.moment.time??'Unknown'),90,1630)
  ctx.fillText('Place '+(design.moment.location?.displayName??'Unknown').slice(0,85),90,1672)
  ctx.fillText('View '+p.heading.toFixed(0)+'° / '+p.pitch.toFixed(0)+'° · '+p.layout+
    ' · '+p.finish+' wood · '+p.tone+' · '+(p.glow?'glow':'no glow'),90,1712)
  ctx.fillText('Illuminated stars: '+illuminatedHip.size+' selected (up to 24) · 11 × 14 in',90,1760)
  ctx.font='17px sans-serif';ctx.fillStyle='#abc4c8'
  ctx.fillText('Your original photo and exact star map are privately saved under this Design ID.',90,1820)
  ctx.font='14px sans-serif';ctx.fillStyle='#8ba8ad'
  ctx.fillText('Etsy design reference only · Physical print and light placement require proof',90,1860)
  return png(canvas)
}
/** Separate high-resolution manufacturing artwork; never use the illustrative
 * order-sheet PNG for print. Trim remains exactly the intended composition.
 * Bleed extends colored edge pixels: obtain lab approval of the proof first.
 */
async function createManufacturingTrim(manifest:OrderManifest,photoUrl:string,
  foregroundUrl:string):Promise<HTMLCanvasElement>{
  const {design,preferences:p}=manifest
  const spec=manifest.manufacturing!.print
  const trim=document.createElement('canvas')
  trim.width=spec.trimPixels.width;trim.height=spec.trimPixels.height
  const ctx=trim.getContext('2d');if(!ctx)throw Error('Print canvas unavailable.')
  const w=trim.width,h=trim.height
  ctx.fillStyle='#071723';ctx.fillRect(0,0,w,h)
  const skyHeight=p.layout==='within'?h:h*p.skyHeight/100
  const grad=ctx.createLinearGradient(0,0,0,skyHeight)
  const palette=p.tone==='teal'?['#081924','#194a5b']:p.tone==='indigo'?
    ['#050e25','#1b2850']:['#040c1d','#213f57']
  grad.addColorStop(0,palette[0]);grad.addColorStop(1,palette[1])
  ctx.fillStyle=grad;ctx.fillRect(0,0,w,skyHeight)
  const aspect=p.layout==='within'?w/h:w/skyHeight
  // The displayed stellar composition follows the same observer projection
  // as the order sheet. Physical LED coordinate alignment is separately held
  // for proofing: canonical M4 coordinates cannot be silently transformed.
  for(const star of design.stars){
    const projected=projectObserverStar(star.azimuthDeg,star.altitudeDeg,p.heading,p.pitch,p.fov)
    if(!projected.inFront)continue
    const point=observerPointInPanel(projected.x,projected.y,aspect)
    if(!point.inside)continue
    const radius=Math.max(1.2,Math.min(5,3.4-star.magnitude*.38))*spec.dpi/300
    const x=point.x*w,y=point.y*skyHeight
    ctx.beginPath();ctx.fillStyle='#f8f3e4'
    ctx.shadowColor='#dce9fb';ctx.shadowBlur=radius*3
    ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill()
  }
  ctx.shadowBlur=0
  if(p.layout==='within'){
    const prepared=await readImage(foregroundUrl)
    ctx.drawImage(prepared,0,0,w,h)
  }else{
    ctx.fillStyle='#071723';ctx.fillRect(0,skyHeight,w,h-skyHeight)
    placePhoto(ctx,await readImage(photoUrl),0,skyHeight,w,h-skyHeight,p.photoFit)
  }
  // Inscription / timestamp are placed inside the requested safe inset.
  // Full visible print is deliberately free of trim marks and guides.
  const inset=spec.safeInsetIn/spec.trimSizeIn.width*w
  const font=Math.max(26,Math.round(w*.02))
  ctx.font=font+'px Georgia';ctx.textAlign='center'
  ctx.fillStyle='#fff0d0'
  ctx.shadowColor='#08111b';ctx.shadowBlur=font*.25
  const caption=[p.inscription.trim(),design.moment.date,
    design.moment.location?.displayName??''].filter(Boolean).join(' · ')
  if(caption){
    const y=h-Math.max(inset,Math.round(h*.035))
    ctx.fillText(caption,w/2,y,Math.max(10,w-2*inset))
  }
  ctx.shadowBlur=0
  return trim
}
/** Never resize visible artwork: extend just its edge pixels per lab variant. */
async function exportPrintVariant(trim:HTMLCanvasElement,spec:PrintSpecification):Promise<Blob>{
  const w=trim.width,h=trim.height
  if(w!==spec.trimPixels.width||h!==spec.trimPixels.height)throw Error('Mismatched trim size.')
  const canvas=document.createElement('canvas')
  canvas.width=spec.documentPixels.width;canvas.height=spec.documentPixels.height
  const out=canvas.getContext('2d');if(!out)throw Error('Print canvas unavailable.')
  // Fully opaque fallback prevents any transparent seams at half-pixel bleed offsets.
  out.fillStyle='#071723';out.fillRect(0,0,canvas.width,canvas.height)
  const x=spec.trimPixels.x,y=spec.trimPixels.y
  // Extend artwork to all four bleed edges; no white pixels/borders.
  out.drawImage(trim,x,y,w,h)
  if(x>0)out.drawImage(trim,0,0,1,h,0,y,x,h)
  if(canvas.width-x-w>0)out.drawImage(trim,w-1,0,1,h,x+w,y,canvas.width-x-w,h)
  if(y>0)out.drawImage(trim,0,0,w,1,x,0,w,y)
  if(canvas.height-y-h>0)out.drawImage(trim,0,h-1,w,1,x,y+h,w,canvas.height-y-h)
  for(const [sx,sy,dx,dy,dw,dh] of [
    [0,0,0,0,x,y],[w-1,0,x+w,0,canvas.width-x-w,y],
    [0,h-1,0,y+h,x,canvas.height-y-h],
    [w-1,h-1,x+w,y+h,canvas.width-x-w,canvas.height-y-h]
  ])if(dw>0&&dh>0)out.drawImage(trim,sx,sy,1,1,dx,dy,dw,dh)
  const pngBlob=await png(canvas)
  const bytes=embedPngDpi(new Uint8Array(await pngBlob.arrayBuffer()),spec.dpi)
  return new Blob([new Uint8Array(bytes).buffer],{type:'image/png'})
}

export async function createCustomerPacket(input:{
  design:DesignSpec;prefs:OrderPreferences;photo:File;photoUrl:string;cutoutUrl:string;savedDesignId?:string;
  quote?:FrameQuote|null;
}):Promise<{manifest:OrderManifest;zip:Blob;sheet:Blob;prepared:Blob|null;
  printVariants:Record<PrintVariantId,Blob>}>{
  if(!input.design.astronomy||!input.design.moment.location)throw Error('Finish the workshop first.')
  if(input.prefs.layout==='within'&&!input.cutoutUrl)throw Error('Save the polished foreground first.')
  // Final LED count must come from the customer's selected PhysicalStars, not
  // the larger catalogue of digital stars visible in the observer view.
  const physicalCount=countPhysicalLeds(input.design)
  const photo=new Uint8Array(await input.photo.arrayBuffer())
  // Server-assigned Design ID supersedes a local packet-only checksum when saved.
  const reference=input.savedDesignId??await orderReference(input.design,input.prefs,photo)
  const original={name:input.photo.name,bytes:input.photo.size,mime:input.photo.type}
  const manifest=makeOrderManifest(reference,input.design,input.prefs,original,new Date().toISOString())
  manifest.manufacturing={
    print:printSpecification(input.design.physicalArtwork.widthMm,
      input.design.physicalArtwork.heightMm),
    selectedPhysicalStars:input.design.physicalStars?.length??null,
    physicalMax:input.design.physicalSelection?.maxPhysicalStars??null,
    physicalSelectionVersion:input.design.physicalSelection?.algorithm??null,
    status:'PROOF_REQUIRED',
    warning:'Physical star alignment to customer preview requires reviewed printed registration; no automatic drilling authorization.',
  }
  if(input.quote)manifest.pricing={priceCents:input.quote.priceCents,currency:'USD',
    mode:input.quote.mode,revision:input.quote.revision,
    updatedAtUtc:input.quote.updatedAtUtc,binding:false}
  const foreground=input.prefs.layout==='within'?
    await fetch(input.cutoutUrl).then(r=>r.blob()):null
  const originalBitmap=await createImageBitmap(input.photo)
  const originalWidth=originalBitmap.width,originalHeight=originalBitmap.height
  let visual:PhotoVisualMetrics
  try{visual=samplePhotoVisualMetrics(originalBitmap)}
  finally{originalBitmap.close()}
  let preparedWidth:number|undefined,preparedHeight:number|undefined
  if(foreground){
    const bitmap=await createImageBitmap(foreground)
    try{preparedWidth=bitmap.width;preparedHeight=bitmap.height}
    finally{bitmap.close()}
  }
  const quality=assessPhotoPrintQuality({
    sourceWidth:originalWidth,sourceHeight:originalHeight,
    artworkWidthMm:input.design.physicalArtwork.widthMm,
    artworkHeightMm:input.design.physicalArtwork.heightMm,
    layout:input.prefs.layout,skyHeight:input.prefs.skyHeight,
    photoFit:input.prefs.photoFit,preparedWidth,preparedHeight,visual
  })
  manifest.manufacturing.photoQuality=quality
  manifest.expectedFiles.push('photo-quality-report.json')
  const maker=buildManufacturingJobPlan({...input.design,designId:reference},input.prefs)
  manifest.manufacturing.candidatePlan={
    version:maker.version,physicalCount:maker.physicalCount,
    geometryValidated:maker.geometryValidated,
    productionStatus:maker.status,holds:[...maker.holds]
  }
  if(assertMakerStarParity(manifest.design,maker,
    manifest.manufacturing.selectedPhysicalStars)!==physicalCount)
    throw Error('The displayed physical LED count changed while preparing this order.')
  const makerFiles=[
    {name:'manufacturing-job-plan.json',
      data:encoder.encode(JSON.stringify(maker,null,2))},
    {name:'physical-star-map.csv',data:encoder.encode(makerStarMapCsv(maker))},
    {name:'candidate-parts.csv',data:encoder.encode(makerPartsCsv(maker))},
    {name:'assembly-checklist.json',data:encoder.encode(makerChecklistJson(maker))}
  ]
  if(maker.geometryValidated)makerFiles.push({
    name:'drill-template-1to1-DRAFT.svg',
    data:encoder.encode(makerDrillTemplateSvg(maker))
  })
  manifest.expectedFiles.push(...makerFiles.map(file=>file.name))
  const sheet=await createOrderSheet(manifest,input.photoUrl,input.cutoutUrl)
  const trim=await createManufacturingTrim(manifest,input.photoUrl,input.cutoutUrl)
  const printVariants={} as Record<PrintVariantId,Blob>
  const variantFiles:{name:string;data:Uint8Array}[]=[]
  manifest.manufacturing.printVariants=[]
  for(const variant of PRINT_VARIANTS){
    const spec=printSpecification(input.design.physicalArtwork.widthMm,
      input.design.physicalArtwork.heightMm,
      {...DEFAULT_PRINT_SETTINGS,bleedIn:variant.bleedIn})
    const art=await exportPrintVariant(trim,spec)
    printVariants[variant.id]=art
    manifest.manufacturing.printVariants.push({id:variant.id,spec})
    variantFiles.push(
      {name:variant.artwork,data:new Uint8Array(await art.arrayBuffer())},
      {name:variant.spec,data:encoder.encode(JSON.stringify(spec,null,2))},
      {name:variant.guide,data:encoder.encode(trimSafeGuideSvg(spec))})
  }
  const content=[
    {name:'order.json',data:encoder.encode(JSON.stringify(manifest,null,2))},
    {name:'order-sheet.png',data:new Uint8Array(await sheet.arrayBuffer())},
    {name:'photo-quality-report.json',data:encoder.encode(JSON.stringify(quality,null,2))},
    ...makerFiles,
    ...variantFiles,
    {name:manifest.expectedFiles[1],data:photo},
    {name:'HOW-TO-ORDER.txt',data:encoder.encode([
      'STARKEEP SAKE · DESIGN REFERENCE '+reference,
      'This packet does not place an order and no payment has been taken.',
      'Complete purchase through the Etsy listing (when configured).',
      'Paste only the saved SK-... Design ID in Etsy required text personalization.',
      'OPTIONAL: upload the buyer design-card PNG in Etsy file personalization.',
      'PNG is for visual reference; file upload alone is NOT an automatic design match.',
      'Never upload maker ZIP, original asset bundle or private edit link to Etsy.',
      'Three 300-DPI formats from one exact 11x14-inch visible composition:',
      '  print-artwork-exact-11x14.png (11x14 in; no bleed)',
      '  print-artwork-bleed-1-8.png (11.25x14.25 in; 1/8 in bleed per edge)',
      '  print-artwork-bleed-1-4.png (11.5x14.5 in; 1/4 in bleed per edge)',
      'Each file has corresponding print-spec-*.json and print-guide-*.svg.',
      'Read photo-quality-report.json for effective source PPI and print review hold.',
      'manufacturing-job-plan.json: exact frozen N-star subset and CANDIDATE parts grouped by type.',
      'physical-star-map.csv: stored camera-projected print coordinates and LED indices.',
      'candidate-parts.csv: counts derived from N; HOLD items must be sourced and approved.',
      'assembly-checklist.json: draft 23-step list, not server-persisted progress.',
      'drill-template-1to1-DRAFT.svg when saved star coordinates validate; never drill without printed registration.',
      'At Etsy handoff the complete maker ZIP is frozen privately by the website.',
      'Do not fabricate until real supplier, electrical and physical proof approvals are completed.',
      'SVG guides are proof overlays ONLY, not part of print image.',
      'Print at native dimensions; do not Fit to Page, resize or autocrop.',
      'Verify the accepted bleed size and physical printed proof with the shop.',
      'Print a physical trim and mounting proof before drilling or production.',
      'Physical LED coordinate registration still requires manual calibration.',
      'The maker must verify that Etsy marks the order paid before assembly.',
    ].join('\n'))},
  ]
  if(foreground)content.push({name:'prepared-foreground.png',
    data:new Uint8Array(await foreground.arrayBuffer())})
  const bytes=zipFiles(content)
  return {manifest,zip:new Blob([new Uint8Array(bytes).buffer],{type:'application/zip'}),
    sheet,prepared:foreground,printVariants}
}
