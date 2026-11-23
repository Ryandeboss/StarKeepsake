import type {MakerPlan} from './manufacturingJobPlan'
import type {OrderManifest} from './orderManifest'
import {PRINT_VARIANTS} from './manufacturingPrint.ts'

/** Read the original checkout's UNCOMPRESSED V1 ZIP; never regenerate a
 * frozen manufacturing snapshot from today's astronomy or print algorithms. */
export async function readFrozenMakerPacket(blob:Blob,designId:string){
  if(!/^SK-[0-9A-F]{16}$/.test(designId)||blob.size<100||
     blob.size>160*1024*1024)throw Error('Invalid frozen maker ZIP.')
  const bytes=new Uint8Array(await blob.arrayBuffer())
  const v=new DataView(bytes.buffer)
  const files:Record<string,Blob>={}
  const decoder=new TextDecoder('utf-8',{fatal:true})
  let index=0,count=0
  while(index+30<=bytes.length&&v.getUint32(index,true)===0x04034b50){
    if(++count>24)throw Error('Unexpected frozen packet contents.')
    const compression=v.getUint16(index+8,true)
    const compressed=v.getUint32(index+18,true)
    const expanded=v.getUint32(index+22,true)
    const nameLength=v.getUint16(index+26,true)
    const extraLength=v.getUint16(index+28,true)
    if(compression!==0||compressed!==expanded||nameLength<3||
      nameLength>130||index+30+nameLength+extraLength+compressed>bytes.length)
      throw Error('Frozen maker ZIP has unsupported or invalid entries.')
    const name=decoder.decode(bytes.slice(index+30,index+30+nameLength))
    if(!/^[a-z0-9_.-]+$/i.test(name)||files[name])
      throw Error('Invalid or duplicated frozen maker file.')
    const start=index+30+nameLength+extraLength
    const mime=name.endsWith('.png')?'image/png':
      name.endsWith('.jpg')||name.endsWith('.jpeg')?'image/jpeg':
      name.endsWith('.webp')?'image/webp':
      name.endsWith('.json')?'application/json':
      name.endsWith('.csv')?'text/csv':
      name.endsWith('.svg')?'image/svg+xml':'application/octet-stream'
    files[name]=blob.slice(start,start+compressed,mime)
    index=start+compressed
  }
  if(!files['order.json']||!files['manufacturing-job-plan.json']||
     !files['order-sheet.png'])throw Error('Frozen maker ZIP is incomplete.')
  const manifest=JSON.parse(await files['order.json'].text()) as OrderManifest
  const plan=JSON.parse(await files['manufacturing-job-plan.json'].text()) as MakerPlan
  if(manifest.reference!==designId||plan.designId!==designId||
    manifest.manufacturing?.candidatePlan?.version!==plan.version||
    manifest.manufacturing?.selectedPhysicalStars!==plan.physicalCount||
    plan.stars.length!==plan.physicalCount)
    throw Error('Frozen packet Design ID, version or star count does not match.')
  if(plan.physicalCount<1||plan.physicalCount>24)
    throw Error('Legacy physical star count exceeds test retail limit.')
  for(const variant of PRINT_VARIANTS){
    if(!files[variant.artwork]||!files[variant.spec]||!files[variant.guide])
      throw Error('Frozen print variant '+variant.id+' is missing.')
  }
  return {manifest,plan,files,preview:files['order-sheet.png']}
}
