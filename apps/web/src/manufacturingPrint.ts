/** Physical print contract: trim is separate from document canvas and bleed.
 * Defaults follow common print practice; verify selected lab before production.
 * No crop/trim guides are embedded in the actual printable image.
 */
export type PrintSettings = {bleedIn:number;safeIn:number;dpi:number}
export const DEFAULT_PRINT_SETTINGS: Readonly<PrintSettings> = Object.freeze({
  bleedIn:0.25,safeIn:0.25,dpi:300,
})
const rounded=(x:number)=>Math.round(x*10000)/10000
export function printSpecification(widthMm:number,heightMm:number,
  settings:PrintSettings=DEFAULT_PRINT_SETTINGS){
  const {bleedIn,safeIn,dpi}=settings
  if (![widthMm,heightMm,bleedIn,safeIn,dpi].every(Number.isFinite) ||
      widthMm<100||heightMm<100||widthMm>650||heightMm>750||
      bleedIn<0.0625||bleedIn>0.5||safeIn<0.125||safeIn>1||
      !Number.isInteger(dpi)||dpi<150||dpi>600||
      safeIn*2>=Math.min(widthMm,heightMm)/25.4){
    throw new Error('Invalid lab print settings or physical artwork dimensions.')
  }
  const trimWidthIn=widthMm/25.4, trimHeightIn=heightMm/25.4
  const documentWidthIn=trimWidthIn+bleedIn*2
  const documentHeightIn=trimHeightIn+bleedIn*2
  const trimWidthPx=Math.round(trimWidthIn*dpi)
  const trimHeightPx=Math.round(trimHeightIn*dpi)
  const documentWidthPx=Math.round(documentWidthIn*dpi)
  const documentHeightPx=Math.round(documentHeightIn*dpi)
  const trimX=(documentWidthPx-trimWidthPx)/2
  const trimY=(documentHeightPx-trimHeightPx)/2
  return {
    format:'starkeepsake-print-spec-v1' as const,unit:'in' as const,
    trimSizeIn:{width:rounded(trimWidthIn),height:rounded(trimHeightIn)},
    documentSizeIn:{width:rounded(documentWidthIn),height:rounded(documentHeightIn)},
    bleedIn:rounded(bleedIn),safeInsetIn:rounded(safeIn),dpi,
    documentPixels:{width:documentWidthPx,height:documentHeightPx},
    trimPixels:{x:trimX,y:trimY,width:trimWidthPx,height:trimHeightPx},
    safePixels:{x:trimX+safeIn*dpi,y:trimY+safeIn*dpi,
      width:trimWidthPx-2*safeIn*dpi,height:trimHeightPx-2*safeIn*dpi},
    bleedMethod:'extended-edge-pixels' as const,
    colorSpace:'sRGB' as const,
    reviewStatus:'PROOF_REQUIRED' as const,
    labInstructions:'Submit at the stated '+rounded(documentWidthIn)+' x '+rounded(documentHeightIn)+
      ' in document dimensions with embedded '+dpi+' DPI. The visible trim is '+
      rounded(trimWidthIn)+' x '+rounded(trimHeightIn)+' in; bleed is '+
      rounded(bleedIn)+' in per edge. Confirm the lab accepts this exact bleed size'+
      ' and does not auto-fit or crop the file before print, mount, and drill proofs.',
  }
}
export type PrintSpecification = ReturnType<typeof printSpecification>

/** Overlay for proofing only; must NOT be printed over the customer artwork. */
export function trimSafeGuideSvg(spec:PrintSpecification){
  const {width:w,height:h}=spec.documentPixels
  const r=spec.trimPixels,s=spec.safePixels
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<title>Print proof overlay only — do not print over final artwork</title>
<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#d5a85e" stroke-width="4"/>
<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="#e85454" stroke-width="4"/>
<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="none" stroke="#18c2c2" stroke-dasharray="15 12" stroke-width="4"/>
</svg>`
}
function crc32(input:Uint8Array):number{
  let crc=0xffffffff
  for(const b of input){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(0xedb88320&-(crc&1))}
  return (crc^0xffffffff)>>>0
}
function put32(bytes:Uint8Array,offset:number,value:number){
  new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint32(offset,value,false)
}
function get32(bytes:Uint8Array,offset:number){
  return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,false)
}
/** PNG canvas exports often report 96 DPI. Insert true PNG pHYs at target DPI. */
export function embedPngDpi(bytes:Uint8Array,dpi:number):Uint8Array{
  if(!Number.isInteger(dpi)||dpi<150||dpi>600||
     bytes.length<33||!([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))){
    throw new Error('Expected PNG and valid print DPI.')
  }
  const ihdrSize=get32(bytes,8)
  if(ihdrSize!==13||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')
    throw new Error('Invalid PNG header.')
  const chunks:Uint8Array[]=[]
  let cursor=8
  while(cursor<bytes.length){
    if(cursor+12>bytes.length)throw new Error('Truncated PNG.')
    const n=get32(bytes,cursor)
    if(cursor+n+12>bytes.length)throw new Error('Truncated PNG chunk.')
    const name=String.fromCharCode(...bytes.slice(cursor+4,cursor+8))
    if(name!=='pHYs')chunks.push(bytes.slice(cursor,cursor+12+n))
    cursor+=12+n
    if(name==='IEND')break
  }
  const ppm=Math.round(dpi/0.0254)
  const chunk=new Uint8Array(21)
  put32(chunk,0,9)
  chunk.set([112,72,89,115],4) // pHYs
  put32(chunk,8,ppm);put32(chunk,12,ppm);chunk[16]=1
  put32(chunk,17,crc32(chunk.slice(4,17)))
  const joined=[...chunks.slice(0,1),chunk,...chunks.slice(1)]
  const total=8+joined.reduce((n,c)=>n+c.length,0)
  const out=new Uint8Array(total)
  out.set(bytes.slice(0,8),0)
  let offset=8;for(const part of joined){out.set(part,offset);offset+=part.length}
  return out
}
