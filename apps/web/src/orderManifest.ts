import type { DesignSpec } from './designSpec'
import type { AbovePhotoFitMode } from './frameSkyBalance'

export type OrderPreferences={
  layout:'above'|'within'; heading:number; pitch:number; fov:number
  skyHeight:number; photoFit:AbovePhotoFitMode
  tone:'natural'|'indigo'|'teal'; glow:boolean
  finish:'walnut'|'oak'|'ebony'; inscription:string
}
export type OrderManifest={
  format:'starkeepsake-order-v1'; reference:string; status:'UNPAID_PREVIEW'
  generatedAt:string; design:DesignSpec; preferences:OrderPreferences
  original:{name:string;bytes:number;mime:string}
  expectedFiles:string[]
}
const encoder=new TextEncoder()
/** Not a database lookup key: it only matches the files the buyer submits. */
export async function orderReference(design:DesignSpec,prefs:OrderPreferences,
  photo:Uint8Array):Promise<string>{
  const metadata=encoder.encode(JSON.stringify({design,prefs}))
  const data=new Uint8Array(metadata.length+photo.length)
  data.set(metadata);data.set(photo,metadata.length)
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data))
  return 'SK-'+[...digest.slice(0,6)].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()
}
export function makeOrderManifest(ref:string,design:DesignSpec,prefs:OrderPreferences,
  original:{name:string;bytes:number;mime:string},when:string):OrderManifest{
  return {format:'starkeepsake-order-v1',reference:ref,status:'UNPAID_PREVIEW',
    generatedAt:when,
    design:{...design,designId:ref,customText:{...design.customText,value:prefs.inscription}},
    preferences:{...prefs},original,expectedFiles:['order-sheet.png','original-photo.'+
      (original.mime==='image/png'?'png':original.mime==='image/webp'?'webp':'jpg'),
      ...(prefs.layout==='within'?['prepared-foreground.png']:[])]}
}
export function orderPersonalization(manifest:OrderManifest):string{
  return ['Reference: '+manifest.reference,'Date: '+manifest.design.moment.date,
    'Time: '+(manifest.design.moment.time??'Unknown'),
    'Location: '+(manifest.design.moment.location?.displayName??'Unknown'),
    'Style: '+manifest.preferences.layout,'Frame: '+manifest.preferences.finish,
    'Inscription: '+(manifest.preferences.inscription||'None'),
    'Please see uploaded order sheet and photo.'].join('\n')
}
function crc(bytes:Uint8Array):number{
  let v=0xffffffff
  for(const b of bytes){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^(0xedb88320&-(v&1))}
  return (v^0xffffffff)>>>0
}
/** Uncompressed ZIP (no dependencies): complete data and raw photo retained. */
export function zipFiles(files:{name:string;data:Uint8Array}[]):Uint8Array{
  if(!files.length||files.length>20)throw Error('Invalid ZIP file count.')
  const local:Uint8Array[]=[],central:Uint8Array[]=[]
  let offset=0
  for(const {name,data} of files){
    if(!/^[a-z0-9_.-]+$/i.test(name)||name.length>120)throw Error('Invalid filename.')
    const n=encoder.encode(name),c=crc(data)
    const a=new Uint8Array(30+n.length),v=new DataView(a.buffer)
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true)
    v.setUint16(6,0x0800,true);v.setUint32(14,c,true)
    v.setUint32(18,data.length,true);v.setUint32(22,data.length,true)
    v.setUint16(26,n.length,true);a.set(n,30)
    const d=new Uint8Array(46+n.length),w=new DataView(d.buffer)
    w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true)
    w.setUint16(6,20,true);w.setUint16(8,0x0800,true)
    w.setUint32(16,c,true);w.setUint32(20,data.length,true)
    w.setUint32(24,data.length,true);w.setUint16(28,n.length,true)
    w.setUint32(42,offset,true);d.set(n,46)
    local.push(a,data);central.push(d);offset+=a.length+data.length
  }
  const dirLength=central.reduce((n,c)=>n+c.length,0)
  const footer=new Uint8Array(22),f=new DataView(footer.buffer)
  f.setUint32(0,0x06054b50,true);f.setUint16(8,files.length,true)
  f.setUint16(10,files.length,true);f.setUint32(12,dirLength,true)
  f.setUint32(16,offset,true)
  const parts=[...local,...central,footer]
  const result=new Uint8Array(parts.reduce((n,x)=>n+x.length,0))
  let index=0;for(const part of parts){result.set(part,index);index+=part.length}
  return result
}
