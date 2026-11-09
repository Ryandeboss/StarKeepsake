import type { DesignSpec } from './designSpec'
import type { AbovePhotoFitMode } from './frameSkyBalance'
import { projectObserverStar } from './skyImmersiveData'
import { observerPointInPanel } from './skyWorkshopMath'
import { orderReference, makeOrderManifest, zipFiles } from './orderManifest'
import type { OrderManifest, OrderPreferences } from './orderManifest'
export type { OrderManifest, OrderPreferences } from './orderManifest'
export { orderPersonalization } from './orderManifest'
const encoder=new TextEncoder()
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
    ' · '+p.finish+' wood · '+p.tone+' · '+(p.glow?'glow':'no glow'),90,1712)
  ctx.font='15px sans-serif';ctx.fillStyle='#98b4bb'
  ctx.fillText('Preview only · physical star lights, frame and materials may differ',90,1763)
  return png(canvas)
}
export async function createCustomerPacket(input:{
  design:DesignSpec;prefs:OrderPreferences;photo:File;photoUrl:string;cutoutUrl:string;;savedDesignId?:string;
}):Promise<{manifest:OrderManifest;zip:Blob;sheet:Blob;prepared:Blob|null}>{
  if(!input.design.astronomy||!input.design.moment.location)throw Error('Finish the workshop first.')
  if(input.prefs.layout==='within'&&!input.cutoutUrl)throw Error('Save the polished foreground first.')
  const photo=new Uint8Array(await input.photo.arrayBuffer())
  // Server-assigned Design ID supersedes a local packet-only checksum when saved.
  const reference=input.savedDesignId??await orderReference(input.design,input.prefs,photo)
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
