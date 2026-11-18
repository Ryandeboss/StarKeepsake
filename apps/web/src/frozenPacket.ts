import {upload} from '@vercel/blob/client'
import type {SavedDesignReceipt} from './savedDesign'
import type {createCustomerPacket} from './customerOrder'

type Packet=Awaited<ReturnType<typeof createCustomerPacket>>
type ArchiveStatus={archived:boolean;frozenAt:string|null;bytes:number|null;
  source:'vercel-private-blob'}

async function getStatus(receipt:SavedDesignReceipt):Promise<ArchiveStatus>{
  const response=await fetch('/api/production/freeze?designId='+
    encodeURIComponent(receipt.designId),{
      headers:{'X-Design-Access-Key':receipt.accessKey},cache:'no-store'
    })
  if(!response.ok)throw Error('Vercel private packet storage is unavailable (HTTP '+
    response.status+'). Order checkout is paused to protect your design.')
  return await response.json() as ArchiveStatus
}
/**
 * The first private ZIP is immutable for the Design ID: no overwrite, no public URL.
 * Unlike a future re-render, this ZIP contains the exact bytes rendered at checkout.
 */
export async function freezeManufacturingPacket(receipt:SavedDesignReceipt,packet:Packet){
  if(packet.manifest.reference!==receipt.designId||
    !/^SK-[0-9A-F]{16}$/.test(receipt.designId)||
    packet.manifest.status!=='UNPAID_PREVIEW')
    throw Error('Saved Design ID and manufacturing packet do not match.')
  const previous=await getStatus(receipt)
  if(previous.archived)return previous
  const path='production/designs/'+receipt.designId+'/frozen-v1.zip'
  await upload(path,packet.zip,{
    access:'private',¶»§q«^