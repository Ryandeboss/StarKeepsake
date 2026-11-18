/** Pure, deterministic final physical-LED selection for the customer's framed view.
 * The astronomical HIP, magnitude, altitude and azimuth never change.
 */
import type { DesignStar, PhysicalStar, PhysicalSelection } from '../../../contracts/design-spec/design-spec'

export const DEFAULT_MAX_PHYSICAL_STARS=24
// Additional driver boards are a *development* option, not validated hardware.
export const MAX_DEVELOPMENT_PHYSICAL_STARS=72
export const DEFAULT_PHYSICAL_SPACING_MM=4.5
export type ViewedCandidate={star:DesignStar;printXMm:number;printYMm:number}
export type ManualPhysicalSelection={mode:'manual';selectedHipIds:number[]}
export type StarSelectionResult={
  physicalStars:PhysicalStar[];physicalSelection:PhysicalSelection;
  candidates:ViewedCandidate[];tooClose:number;outside:number
}

const distanceSquared=(a:ViewedCandidate,b:ViewedCandidate)=>
  (a.printXMm-b.printXMm)**2+(a.printYMm-b.printYMm)**2

export function selectVisiblePhysicalStars(input:readonly ViewedCandidate[],
  max:number=DEFAULT_MAX_PHYSICAL_STARS,
  spacingMm:number=DEFAULT_PHYSICAL_SPACING_MM,
  manual:ManualPhysicalSelection|null=null,
):StarSelectionResult {
  if(!Number.isInteger(max)||max<1||max>128)throw Error('Invalid physical star maximum.')
  if(!Number.isFinite(spacingMm)||spacingMm<1||spacingMm>20)
    throw Error('Invalid physical minimum separation.')
  const byHip=new Map<number,ViewedCandidate>()
  for(const candidate of input){
    if(!Number.isInteger(candidate.star.hipparcosId)||candidate.star.hipparcosId<=0||
       !Number.isFinite(candidate.star.magnitude)||!Number.isFinite(candidate.printXMm)||
       !Number.isFinite(candidate.printYMm))continue
    if(!byHip.has(candidate.star.hipparcosId))
      byHip.set(candidate.star.hipparcosId,candidate)
  }
  const candidates=[...byHip.values()].sort((a,b)=>
    a.star.magnitude-b.star.magnitude||a.star.hipparcosId-b.star.hipparcosId)
  const selected:ViewedCandidate[]=[]
  const reasons=new Map<number,{reason:'view_auto'|'view_manual';priority:number}>()
  const spacingSq=spacingMm*spacingMm
  const nearestSq=(c:ViewedCandidate)=>
    selected.reduce((best,s)=>Math.min(best,distanceSquared(c,s)),Infinity)
  const mayAdd=(c:ViewedCandidate)=>nearestSq(c)>=spacingSq
  let tooClose=0
  if(manual?.mode==='manual'){
    const deduped=[...new Set(manual.selectedHipIds.filter(
      hip=>Number.isInteger(hip)&&hip>0).slice(0,500))]
    for(const hip of deduped){
      const candidate=byHip.get(hip)
      if(!candidate)continue
      if(selected.length>=max)break
      if(!mayAdd(candidate)){tooClose++;continue}
      selected.push(candidate)
      reasons.set(hip,{reason:'view_manual',priority:1})
    }
  }else if(candidates.length<=max){
    // Every safely drillable visible star gets an LED (no global 24-star rule).
    for(const c of candidates){
      if(mayAdd(c)){selected.push(c);reasons.set(c.star.hipparcosId,{reason:'view_auto',priority:1})}
      else tooClose++
    }
  }else{
    // Unambiguously bright, well-spaced anchors remain, then add spatial coverage.
    const anchors=Math.min(max,Math.max(1,Math.floor(max/5)))
    for(const c of candidates){
      if(selected.length>=anchors)break
      if(!mayAdd(c))continue
      selected.push(c)
      reasons.set(c.star.hipparcosId,{reason:'view_auto',priority:1})
    }
    const xs=candidates.map(c=>c.printXMm),ys=candidates.map(c=>c.printYMm)
    const coverageScale=Math.max(12,Math.hypot(Math.max(...xs)-Math.min(...xs),
      Math.max(...ys)-Math.min(...ys))/6)
    const used=new Set(selected.map(c=>c.star.hipparcosId))
    while(selected.length<max){
      let best:ViewedCandidate|null=null,bestScore=-Infinity
      for(const c of candidates){
        if(used.has(c.star.hipparcosId))continue
        const sq=nearestSq(c)
        if(sq<spacingSq)continue
        const brightness=Math.min(1,Math.max(0,(6.5-c.star.magnitude)/8.5))
        const coverage=Math.min(1,Math.sqrt(sq)/coverageScale)
        const score=1.7*brightness+1.25*coverage
        if(score>bestScore+1e-10||(Math.abs(score-bestScore)<=1e-10&&best&&
          (c.star.magnitude<best.star.magnitude||
           c.star.magnitude===best.star.magnitude&&c.star.hipparcosId<best.star.hipparcosId))){
          best=c;bestScore=score
        }
      }
      if(!best)break
      selected.push(best);used.add(best.star.hipparcosId)
      reasons.set(best.star.hipparcosId,{reason:'view_auto',priority:Number(bestScore.toFixed(5))})
    }
  }
  const physicalStars=selected.map((c,index):PhysicalStar=>({
    ...c.star,printXMm:Number(c.printXMm.toFixed(3)),
    printYMm:Number(c.printYMm.toFixed(3)),ledIndex:index,
    selectionReason:reasons.get(c.star.hipparcosId)!.reason,
    selectionPriority:reasons.get(c.star.hipparcosId)!.priority,
  }))
  const physicalSelection:PhysicalSelection={
    algorithm:manual?'view-manual-v1':'view-bright-spatial-v1',
    maxPhysicalStars:max,minSeparationMm:spacingMm,
    eligibleStars:candidates.length,selectedStars:physicalStars.length,
    driverChannelsPerBoard:24,estimatedDriverCount:Math.ceil(physicalStars.length/24),
    coordinateSpace:'observer-print-v1',skippedForSpacing:tooClose,
  }
  return {physicalStars,physicalSelection,candidates,tooClose,outside:0}
}

export function physicalToggleError(target:ViewedCandidate,
  selected:readonly PhysicalStar[],max:number,spacingMm:number):string|null{
  if(selected.some(s=>s.hipparcosId===target.star.hipparcosId))return null
  if(selected.length>=max)return 'At the physical-light limit. Turn another star off first.'
  if(selected.some(s=>((s.printXMm??s.xMm)-target.printXMm)**2+
      ((s.printYMm??s.yMm)-target.printYMm)**2<spacingMm*spacingMm)){
    return 'That star is too close to another selected LED for the current hole-spacing setting.'
  }
  return null
}
