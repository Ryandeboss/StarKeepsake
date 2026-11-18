/**
 * Source-photo quality measured at the ACTUAL printed photograph footprint.
 * This does not mistake a 300-DPI output canvas for genuine source resolution.
 * The current compositor uses the fit/crop behavior mirrored below.
 */
import type {AbovePhotoFitMode} from './photoSkyLayout'

export const PHOTO_QUALITY_VERSION='photo-print-preflight-v1' as const
export type PhotoVisualMetrics={
  sampledPixels:number;lumaStdDev:number;laplacianVariance:number;
  darkPercent:number;lightPercent:number
}
export type PhotoQualityInput={
  sourceWidth:number;sourceHeight:number;
  artworkWidthMm:number;artworkHeightMm:number;
  layout:'above'|'within';skyHeight:number;photoFit:AbovePhotoFitMode;
  preparedWidth?:number|null;preparedHeight?:number|null;
  visual?:PhotoVisualMetrics|null
}
export type PhotoQualityStatus='excellent'|'good'|'caution'|'review'
export type PhotoQualityReport={
  version:typeof PHOTO_QUALITY_VERSION;status:PhotoQualityStatus;
  needsOwnerReview:boolean;sourcePixels:{width:number;height:number};
  sampledPhotoPixels:{width:number;height:number};
  printedPhotoIn:{width:number;height:number};
  usedSourceCrop:{x:number;y:number;width:number;height:number};
  ppiX:number;ppiY:number;effectivePpi:number;
  artworkTrimIn:{width:number;height:number};artworkIs11x14:boolean;
  visual:PhotoVisualMetrics|null;warnings:string[];
  assessment:'PRELIMINARY_SOURCE_PREFLIGHT';photoIsUnaltered:true
}
const round=(x:number)=>Math.round(x*100)/100
const tolerance=0.03
/** The 11x14 print is a physical product requirement, not a preview suggestion. */
export function isExact11x14Artwork(widthMm:number,heightMm:number){
  return Number.isFinite(widthMm)&&Number.isFinite(heightMm)&&
    Math.abs(widthMm-279.4)<.2&&Math.abs(heightMm-355.6)<.2
}
export function assessPhotoPrintQuality(input:PhotoQualityInput):PhotoQualityReport{
  const {sourceWidth:sw,sourceHeight:sh,artworkWidthMm:wm,
    artworkHeightMm:hm,layout,skyHeight,photoFit}=input
  if(![sw,sh,wm,hm,skyHeight].every(Number.isFinite) ||
    ![sw,sh].every(x=>Number.isInteger(x)&&x>0&&x<=100000) ||
    wm<=0||hm<=0 || !['above','within'].includes(layout) ||
    skyHeight<0||skyHeight>=100 ||
    !['fit','stretch','center-crop','top-crop','bottom-crop'].includes(photoFit))
    throw Error('Invalid photo or print geometry for quality preflight.')
  const panelW=wm/25.4
  const panelH=(hm/25.4)*(layout==='within'?1:1-skyHeight/100)
  const width=layout==='within'&&input.preparedWidth?Math.min(sw,input.preparedWidth):sw
  const height=layout==='within'&&input.preparedHeight?Math.min(sh,input.preparedHeight):sh
  let printedWidth=panelW,printedHeight=panelH
  let usedWidth=sw,usedHeight=sh,cropX=0,cropY=0
  // Within-photo compositor currently stretches its prepared foreground to
  // full trim. Report both anisotropic PPI and possible distortion honestly.
  if(layout==='above' && photoFit==='fit'){
    const scale=Math.min(panelW/sw,panelH/sh)
    printedWidth=sw*scale;printedHeight=sh*scale
  }else if(layout==='above'&&photoFit!=='stretch'){
    const scale=Math.max(panelW/sw,panelH/sh)
    usedWidth=Math.min(sw,panelW/scale);usedHeight=Math.min(sh,panelH/scale)
    cropX=(sw-usedWidth)/2
    cropY=photoFit==='top-crop'?sh-usedHeight:
      photoFit==='bottom-crop'?0:(sh-usedHeight)/2
  }
  const ppiX=width/printedWidth,ppiY=height/printedHeight
  const effectivePpi=Math.min(ppiX,ppiY)
  const artworkIs11x14=isExact11x14Artwork(wm,hm)
  const warnings:string[]=[]
  let needsOwnerReview=effectivePpi<150
  if(!artworkIs11x14){
    warnings.push('This saved artwork is not the required 11 × 14-inch physical trim. Do not resize a legacy design silently; revalidate its composition and LED placement.')
    needsOwnerReview=true
  }
  if(layout==='within'||photoFit==='stretch'){
    const sourceAspect=sw/sh
    const printAspect=panelW/panelH
    if(Math.abs(sourceAspect/printAspect-1)>tolerance){
      warnings.push('The current composition stretches the source photograph to the print aspect ratio. Review facial proportions and crop before manufacturing.')
      needsOwnerReview=true
    }
  }
  const keptArea=(usedWidth*usedHeight)/(sw*sh)
  if(keptArea<.5)
    warnings.push('More than half the source photograph is outside this printed crop. Inspect faces and important details.')
  if(effectivePpi<150)
    warnings.push('Insufficient original pixels for the intended printed photo size; owner print approval required.')
  else if(effectivePpi<200)
    warnings.push('Resolution is below our 200-PPI preferred minimum. Check a physical print proof.')
  else if(effectivePpi<250)
    warnings.push('Usable source resolution; examine detail and print-shop specifications.')
  const visual=input.visual??null
  if(visual){
    if(visual.lumaStdDev<12 && visual.laplacianVariance<8)
      warnings.push('The sampled photograph has very little high-frequency detail. It may be soft or deliberately minimalist; inspect at 100%.')
    if(visual.darkPercent>90)
      warnings.push('Most sampled pixels are very dark; check the print exposure with your lab.')
    if(visual.lightPercent>90)
      warnings.push('Most sampled pixels are near white; inspect highlight detail.')
  }
  let status:PhotoQualityStatus=effectivePpi>=250?'excellent':
    effectivePpi>=200?'good':effectivePpi>=150?'caution':'review'
  if(needsOwnerReview)status='review'
  return {
    version:PHOTO_QUALITY_VERSION,status,needsOwnerReview,
    sourcePixels:{width:sw,height:sh},
    sampledPhotoPixels:{width:round(width),height:round(height)},
    printedPhotoIn:{width:round(printedWidth),height:round(printedHeight)},
    usedSourceCrop:{x:round(cropX),y:round(cropY),
      width:round(usedWidth),height:round(usedHeight)},
    ppiX:round(ppiX),ppiY:round(ppiY),effectivePpi:round(effectivePpi),
    artworkTrimIn:{width:round(panelW),height:round(hm/25.4)},artworkIs11x14,
    visual,warnings,
    assessment:'PRELIMINARY_SOURCE_PREFLIGHT',photoIsUnaltered:true,
  }
}
/**
 * Lightweight, non-AI and intentionally nonbinding visual heuristics.
 * Small canvas never replaces the original file. Blur tests cannot distinguish
 * intended bokeh, silhouettes or night exposures from faulty focus.
 */
export function samplePhotoVisualMetrics(bitmap:ImageBitmap):PhotoVisualMetrics{
  const scale=Math.min(1,192/Math.max(bitmap.width,bitmap.height))
  const w=Math.max(3,Math.round(bitmap.width*scale))
  const h=Math.max(3,Math.round(bitmap.height*scale))
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
  const ctx=canvas.getContext('2d',{willReadFrequently:true})
  if(!ctx)throw Error('Photo quality sampling unavailable.')
  ctx.drawImage(bitmap,0,0,w,h)
  const rgba=ctx.getImageData(0,0,w,h).data
  const luma=new Float32Array(w*h)
  let sum=0,sumSq=0,dark=0,light=0
  for(let i=0;i<luma.length;i++){
    const k=i*4
    const v=rgba[k]*.2126+rgba[k+1]*.7152+rgba[k+2]*.0722
    luma[i]=v;sum+=v;sumSq+=v*v
    if(v<18)dark++
    if(v>245)light++
  }
  const mean=sum/luma.length
  let lapSum=0,lapSq=0,count=0
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x
    const lap=4*luma[i]-luma[i-1]-luma[i+1]-luma[i-w]-luma[i+w]
    lapSum+=lap;lapSq+=lap*lap;count++
  }
  return {sampledPixels:luma.length,
    lumaStdDev:round(Math.sqrt(Math.max(0,sumSq/luma.length-mean*mean))),
    laplacianVariance:round(Math.max(0,lapSq/count-(lapSum/count)**2)),
    darkPercent:round(dark*100/luma.length),
    lightPercent:round(light*100/luma.length),
  }
}