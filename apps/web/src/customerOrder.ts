import type { DesignSpec } from './designSpec'
import type { AbovePhotoFitMode } from './frameSkyBalance'
import { projectObserverStar } from './skyImmersiveData'
import { observerPointInPanel } from './skyWorkshopMath'

export type OrderPreferences={
  layout:'above'|'within'; heading:number; pitch:number; fov:number
  skyHeight:number; photoFit:AbovePhotoFitMode
  tone:'natural'|'indigo'|'teal'; glow:boolean; inscription:string
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
    'Style: '+manifest.preferences.layout,'Inscription: '+(manifest.preferences.inscription||'None'),
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
  const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1800
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unsupported.')
  ctx.fillStyle='#071723';ctx.fillRect(0,0,1400,1800)
  ctx.fillStyle='#f1deb9';ctx.font='44px Georgia'
  ctx.fillText('STARKEEPSAKE',90,95)
  ctx.font='22px sans-serif';ctx.fillStyle='#b9cfd0'
  ctx.fillText('YOUR MOMENT  /  CUSTOMER DESIGN SHEET',90,142)
  ctx.font='30px Georgia';ctx.fillStyle='#efd3a0'
  ctx.fillText(manifest.reference,90,203)
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
  for(const star of design.stars){
    const projected=projectObserverStar(star.azimuthDeg,star.altitudeDeg,p.heading,p.pitch,p.fov)
    if(!projected.inFront)continue
    const point=observerPointInPanel(projected.x,projected.y,aspect)
    if(!point.inside)continue
    const px=x+point.x*w,py=y+point.y*skyHeight
    const radius=Math.max(1,4.4-star.magnitude*.55)
    ctx.beginPath();ctx.fillStyle='rgba(255,247,227,.75)'
    ctx.shadowBlur=radius*6;ctx.shadowColor='#eff2ff'
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
    ' · '+p.tone+' · '+(p.glow?'glow':'no glow'),90,1712)
  ctx.font='15px sans-serif';ctx.fillStyle='#98b4bb'
  ctx.fillText('Preview only · physical star lights, frame and materials may differ',90,1763)
  return png(canvas)
}
export async function createCustomerPacket(input:{
  design:DesignSpec;prefs:OrderPreferences;photo:File;photoUrl:string;cutoutUrl:string;
}):Promise<{manifest:OrderManifest;zip:Blob;sheet:Blob;prepared:Blob|null}>{
  if(!input.design.astronomy||!input.design.moment.location)throw Error('Finish the workshop first.')
  if(input.prefs.layout==='within'&&!input.cutoutUrl)throw Error('Save the polished foreground first.')
  const photo=new Uint8Array(await input.photo.arrayBuffer())
  const reference=await orderReference(input.design,input.prefs,photo)
  const original={name:input.photo.name,bytes:input.photo.size,mime:input.photo.type}
  const manifest=makeOrderManifest(reference,input.design,input.prefs,original,new Date().toISOString())
  const foreground=input.prefs.layout==='within'?
    await fetch(input.cutoutUrl).then(r=>r.blob()):null
  const sheet=await createOrderSheet(manifest,input.photoUrl,input.cutoutUrl)
  const content=[
    {name:'order.json',data:encoder.encode(JSON.stringify(manifest,null,2))},
    {name:'order-sheet.png',data:new Uint8Array(await sheet.arrayBuffer())},
    {name:manifest.expectedFiles[1],data:photo},
    {name:'HOW-TO-ORDER.txt',data:encoder.encode([
      'STARKEEP SAKE · DESIGN REFERENCE '+reference,
      'This packet does not place an order and no payment has been taken.',
      'Complete purchase through the Etsy listing (when configured).',
      'In the Etsy custom options upload: order-sheet.png, original-photo image',
      'and prepared-foreground.png if this design uses stars inside the photo.',
      'Enter the reference in the Etsy design reference field.',
      'The maker must verify that Etsy marks the order paid before assembly.',
    ].join('\n'))},
  ]
  if(foreground)content.push({name:'prepared-foreground.png',
    data:new Uint8Array(await foreground.arrayBuffer())})
  const bytes=zipFiles(content)
  return {manifest,zip:new Blob([new Uint8Array(bytes).buffer],{type:'application/zip'}),
    sheet,prepared:foreground}
}
