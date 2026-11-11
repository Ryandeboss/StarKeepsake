import type { OrderManifest } from './orderManifest'

// Etsy is the seller-of-record checkout. StarKeepsake never receives payment
// information, opens carts automatically, or exposes the design access key.
export type PhysicalFinish='walnut'|'ebony'
export type EtsyListingConfig={
  walnut?:string|null
  ebony?:string|null
  shared?:string|null
}
export type EtsyListingChoice={
  url:string
  source:'finish'|'shared'
  requiresFinishSelection:boolean
  finish:PhysicalFinish
}
const ID=/^SK-[0-9A-F]{16}$/
export function isSavedDesignId(value:string):boolean{return ID.test(value)}
export function trustedEtsyListing(url:string|undefined|null):string|null{
  if(!url||url.trim().length>500)return null
  try {
    const parsed=new URL(url.trim())
    if(parsed.protocol!=='https:' || !['www.etsy.com','etsy.com'].includes(parsed.hostname)||
       parsed.username||parsed.password||parsed.port||parsed.search||parsed.hash)return null
    // Only an actual product listing, not an Etsy shop root or ambiguous search.
    if(!/^\/listing\/[1-9][0-9]{0,19}(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(parsed.pathname))return null
    return 'https://www.etsy.com'+parsed.pathname.replace(/\/$/,'')
  }catch{return null}
}
export function etsyListingForFinish(
  finish:string,settings:EtsyListingConfig
):EtsyListingChoice|null{
  if(finish!=='walnut'&&finish!=='ebony')return null
  const direct=trustedEtsyListing(settings[finish])
  if(direct)return {url:direct,source:'finish',requiresFinishSelection:false,finish}
  const shared=trustedEtsyListing(settings.shared)
  return shared?{url:shared,source:'shared',requiresFinishSelection:true,finish}:null
}
export function canContinueToEtsy(input:{
  designSaved:boolean
  savedDesignId:string|null|undefined
  manifest:OrderManifest|null
  listing:EtsyListingChoice|null
}):boolean{
  const {designSaved,savedDesignId,manifest,listing}=input
  return designSaved && Boolean(savedDesignId&&isSavedDesignId(savedDesignId)) &&
    manifest?.reference===savedDesignId &&
    manifest.preferences.finish===listing?.finish &&
    Boolean(listing?.url) && manifest.status==='UNPAID_PREVIEW'
}
