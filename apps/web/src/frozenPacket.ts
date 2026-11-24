import {upload} from '@vercel/blob/client'
import type {SavedDesignReceipt} from './savedDesign'
import type {createCustomerPacket} from './customerOrder'

type Packet=Awaited<ReturnType<typeof createCustomerPacket>>
type FrozenStatus={archived:boolean;frozenAt:string|null;bytes:number|null}

/** Never make the Etsy link actionable before the original ZIP is privately stored. */
export async function getFrozenStatus(receipt:SavedDesignReceipt):Promise<FrozenStatus>{
  const response=await fetch('/api/production/freeze?designId='+
    encodeURIComponent(receipt.designId),{
      cache:'no-store',headers:{'X-Design-Access-Key':receipt.accessKey}
    })
  if(!response.ok)throw Error('Secure manufacturing archive is unavailable. '+
    'Etsy checkout is paused for this design (HTTP '+response.status+').')
  return await response.json() as FrozenStatus
}
export async function freezeManufacturingPacket(
  receipt:SavedDesignReceipt,packet:Packet
):Promise<FrozenStatus>{
  if(packet.manifest.reference!==receipt.designId||
    !/^SK-[0-9A-F]{16}$/.test(receipt.designId)||
    packet.manifest.status!=='UNPAID_PREVIEW')
    throw Error('Saved Design ID and manufacturing packet do not match.')
  const existing=await getFrozenStatus(receipt)
  if(existing.archived)return existing
  const path='production/designs/'+receipt.designId+'/frozen-v1.zip'
  await upload(path,packet.zip,{
    access:'private',
    handleUploadUrl:'/api/production/freeze',
    clientPayload:JSON.stringify({designId:receipt.designId,
      accessKey:receipt.accessKey,
      physicalCount:assertManifestStarParity(packet.manifest)})
  })
  const result=await getFrozenStatus(receipt)
  if(!result.archived)throw Error(
    'Manufacturing ZIP upload is not yet confirmed. Please retry before Etsy.')
  return result
}
