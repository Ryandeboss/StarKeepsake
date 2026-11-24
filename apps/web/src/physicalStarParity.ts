/** One authoritative count for physical LEDs, never the digital star count.
 * A design may show more digital stars than can safely be drilled.
 * Fail closed rather than silently claiming a different quantity in Etsy files. */
import type {DesignSpec} from './designSpec'
import type {MakerPlan} from './manufacturingJobPlan'
import type {OrderManifest} from './orderManifest'

type PhysicalDesign=Pick<DesignSpec,'physicalStars'|'physicalSelection'>
type PhysicalMaker=Pick<MakerPlan,'physicalCount'|'stars'>

export function countPhysicalLeds(design:PhysicalDesign):number{
  const selected=design.physicalStars??[]
  const n=selected.length
  if(n<1||n>24)throw Error(
    'Your keepsake needs 1–24 finalized physical LED stars before it can be saved for manufacture.')
  if(design.physicalSelection&&design.physicalSelection.selectedStars!==n)
    throw Error('Selected physical-star count changed. Review the stars and prepare the order again.')
  const seen=new Set<number>()
  selected.forEach((star,index)=>{
    if(star.ledIndex!==index||
      !Number.isInteger(star.hipparcosId)||star.hipparcosId<=0||
      seen.has(star.hipparcosId))
      throw Error('Physical star numbering changed. Review your star choices before ordering.')
    seen.add(star.hipparcosId)
  })
  return n
}

/** Compare the customer-visible LED set with the *actual* archived maker plan.
 * Never silently replace the frozen stars with a later camera recalculation. */
export function assertMakerStarParity(
  design:PhysicalDesign,plan:PhysicalMaker,
  reportedCount:number|null|undefined,
):number{
  const expected=countPhysicalLeds(design)
  if(plan.physicalCount!==expected||plan.stars.length!==expected||
    reportedCount!==expected)
    throw Error('Physical star count does not match the manufacturing packet. Reprepare the design.')
  const stars=design.physicalStars!
  for(let i=0;i<expected;i++){
    if(plan.stars[i].ledIndex!==stars[i].ledIndex||
      plan.stars[i].hipparcosId!==stars[i].hipparcosId)
      throw Error('Physical star identities changed in the manufacturing packet. Reprepare the design.')
  }
  return expected
}

export function assertManifestStarParity(manifest:OrderManifest):number{
  const expected=countPhysicalLeds(manifest.design)
  if(!manifest.manufacturing||
    manifest.manufacturing.selectedPhysicalStars!==expected||
    manifest.manufacturing.candidatePlan?.physicalCount!==expected)
    throw Error('Frozen artwork and physical LED count disagree. Reprepare the design.')
  return expected
}
