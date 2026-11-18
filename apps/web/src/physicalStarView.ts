/** Convert the customer-facing camera view to trim-space locations for real LEDs.
 * The catalog coordinates are preserved as xMm/yMm; printXMm/printYMm
 * are a second, explicitly camera-dependent projection for registration.
 */
import type {DesignSpec} from './designSpec'
import type {AbovePhotoFitMode} from './frameSkyBalance'
import {skyAboveArtworkAspect} from './frameSkyBalance'
import {projectObserverStar} from './skyImmersiveData'
import {observerPointInPanel} from './skyWorkshopMath'
import {maskWorkingDimensions} from './skyMaskMath'
import {DEFAULT_MAX_PHYSICAL_STARS,DEFAULT_PHYSICAL_SPACING_MM,
  selectVisiblePhysicalStars,type ViewedCandidate} from './physicalStarSelection'

export type PhysicalViewOptions={
  heading:number;pitch:number;fov:number;
  layout:'above'|'within';skyHeight:number;imageAspect:number;
  maskAlpha:Uint8ClampedArray|null;
  maskDimensions:{width:number;height:number}|null;
  photoFit:AbovePhotoFitMode;
}
export function makePhysicalView(design:DesignSpec,view:PhysicalViewOptions){
  const {widthMm,heightMm}=design.physicalArtwork
  const skyFraction=view.layout==='within'?1:view.skyHeight/100
  const frameAspect=view.layout==='above'?
    skyAboveArtworkAspect(view.imageAspect,view.skyHeight):view.imageAspect
  const previewAspect=view.layout==='within'?frameAspect:frameAspect/skyFraction
  const actualPrintAspect=widthMm/(heightMm*skyFraction)
  let maskWidth=0,maskHeight=0
  if(view.maskAlpha&&view.maskDimensions){
    const dimensions=maskWorkingDimensions(view.maskDimensions.width,view.maskDimensions.height)
    if(view.maskAlpha.length===dimensions.width*dimensions.height){
      maskWidth=dimensions.width;maskHeight=dimensions.height
    }
  }
  const candidates:ViewedCandidate[]=[]
  let visibleDigitalCount=0,unavailableForDrilling=0
  for(const star of design.stars){
    const point=projectObserverStar(star.azimuthDeg,star.altitudeDeg,
      view.heading,view.pitch,view.fov)
    if(!point.inFront)continue
    const screen=observerPointInPanel(point.x,point.y,previewAspect)
    if(!screen.inside)continue
    if(view.layout==='within'&&maskWidth&&maskHeight&&view.maskAlpha){
      const x=Math.max(0,Math.min(maskWidth-1,Math.floor(screen.x*maskWidth)))
      const y=Math.max(0,Math.min(maskHeight-1,Math.floor(screen.y*maskHeight)))
      if(view.maskAlpha[y*maskWidth+x]>=110)continue
    }
    visibleDigitalCount++
    const print=observerPointInPanel(point.x,point.y,actualPrintAspect)
    if(!print.inside){unavailableForDrilling++;continue}
    const printXMm=print.x*widthMm
    const printYMm=print.y*heightMm*skyFraction
    // A drilled fiber/LED aperture must not collide with the finished trim.
    const margin=2+star.holeSizeMm/2
    if(printXMm<margin||printXMm>widthMm-margin||
      printYMm<margin||printYMm>heightMm*skyFraction-margin){
      unavailableForDrilling++;continue
    }
    candidates.push({star,printXMm,printYMm})
  }
  // Centralized product development cap, never tied to the number of channels
  // on the temporary driver. Respect a smaller backend-configured maximum.
  const backendMax=design.physicalSelection?.maxPhysicalStars
  const productMax=Number.isInteger(backendMax)&&backendMax!==undefined&&backendMax>0
    ?Math.min(DEFAULT_MAX_PHYSICAL_STARS,backendMax)
    :DEFAULT_MAX_PHYSICAL_STARS
  const requestedSpacing=design.physicalSelection?.minSeparationMm
  const spacing=Number.isFinite(requestedSpacing)&&requestedSpacing!==undefined&&
    requestedSpacing>=1&&requestedSpacing<=20?requestedSpacing:DEFAULT_PHYSICAL_SPACING_MM
  const override=design.physicalStarOverrides
  const manual=override?.mode==='manual'&&Array.isArray(override.selectedHipIds)
    ?override:null
  const selection=selectVisiblePhysicalStars(candidates,productMax,spacing,manual)
  return {...selection,visibleDigitalCount,unavailableForDrilling}
}
