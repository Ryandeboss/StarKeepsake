/** Sky-lab mask refinement, independent of UI and AI provider.
 * Never alter original RGB. A conservative initial mask makes restoring
 * delicate trees and skyline details easier.
 */
export function conservativeSkyMask(
  raw: Uint8Array, width: number, height: number,
  inset = Math.max(4, Math.min(10, Math.round(Math.min(width,height)*.009))),
  photo?: Uint8ClampedArray,
): Uint8Array {
  if(width<=0||height<=0||raw.length!==width*height||
     (photo&&photo.length!==width*height*4))
    throw new Error('Sky segmentation dimensions do not match.')

  // DeepLab can confuse dark tree leaves / masonry with sky, even when those
  // pixels touch a large upper connected component. Respect original RGB.
  function eligible(i: number): boolean {
    if(!raw[i])return false
    if(!photo)return true
    const j=i*4, r=photo[j], g=photo[j+1], b=photo[j+2]
    const luma=(77*r+150*g+29*b)/256
    const blueSky=b>r*1.26 && b>g*1.10 && b>90 && g>42
    const greenFoliage=g>r*1.12 && g>b*1.08
    return !greenFoliage && (luma>=103 || blueSky)
  }

  const seen=new Uint8Array(raw.length)
  const queue=new Int32Array(raw.length)
  let tail=0,head=0
  function enqueue(i:number) {
    if(!eligible(i)||seen[i])return
    seen[i]=1
    queue[tail++]=i
  }

  let topHits=0
  for(let x=0;x<width;x++){
    if(eligible(x))topHits++
    enqueue(x)
  }
  // Only allow shallow side seeds when the photograph has little open sky
  // along the top; old 32%-height side seeding could cut into tall buildings.
  if(topHits/width<.16){
    const sideDepth=Math.max(1,Math.floor(height*.06))
    for(let y=0;y<sideDepth;y++){
      enqueue(y*width)
      enqueue(y*width+width-1)
    }
  }
  while(head<tail){
    const i=queue[head++],x=i%width,y=(i/width)|0
    if(x>0)enqueue(i-1)
    if(x<width-1)enqueue(i+1)
    if(y>0)enqueue(i-width)
    if(y<height-1)enqueue(i+width)
  }
  const radius=Math.max(0,Math.min(12,Math.floor(inset)))
  if(!radius)return seen

  // Erode connected sky away from trees, buildings and any foreground-colored
  // pixel (including DeepLab false positives). 8-way distance transform runs
  // in O(image pixels) rather than scanning a large square at every sky pixel.
  const dist=new Uint8Array(raw.length)
  const edgeQueue=new Int32Array(raw.length)
  let front=0,end=0
  for(let i=0;i<seen.length;i++){
    if(!seen[i]){dist[i]=1;edgeQueue[end++]=i}
  }
  while(front<end){
    const i=edgeQueue[front++],d=dist[i]
    if(d>radius)continue
    const x=i%width,y=(i/width)|0
    for(let dy=-1;dy<=1;dy++){
      const yy=y+dy
      if(yy<0||yy>=height)continue
      for(let dx=-1;dx<=1;dx++){
        const xx=x+dx
        if(xx<0||xx>=width)continue
        const next=yy*width+xx
        if(dist[next]||!seen[next])continue
        dist[next]=d+1
        edgeQueue[end++]=next
      }
    }
  }
  const clean=new Uint8Array(raw.length)
  for(let i=0;i<seen.length;i++)if(seen[i] && !dist[i])clean[i]=1
  return clean
}

export type CleanupRect={x0:number;y0:number;x1:number;y1:number}

/** Smart drag: clean only light, low-chroma sky pockets inside a rectangle.
 * Preserve branches, people and dark façades, including small holes between
 * leaves. Manual restore explicitly overrides the selection.
 */
export function smartRectangleCleanup(
  original:Uint8ClampedArray,alpha:Uint8ClampedArray,
  width:number,height:number,rect:CleanupRect,restore:boolean,
):number{
  if(original.length!==width*height*4||alpha.length!==width*height)
    throw new Error('Image and mask dimensions do not match.')
  const left=Math.max(0,Math.floor(Math.min(rect.x0,rect.x1)))
  const right=Math.min(width,Math.ceil(Math.max(rect.x0,rect.x1)))
  const top=Math.max(0,Math.floor(Math.min(rect.y0,rect.y1)))
  const bottom=Math.min(height,Math.ceil(Math.max(rect.y0,rect.y1)))
  let changed=0
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const i=y*width+x,j=i*4
    const r=original[j],g=original[j+1],b=original[j+2]
    const luma=(77*r+150*g+29*b)/256
    if(!restore&&(
      original[j+3]<160||luma<178||
      Math.max(r,g,b)-Math.min(r,g,b)>70
    ))continue
    const next=restore?original[j+3]:0
    if(alpha[i]!==next){alpha[i]=next;changed++}
  }
  return changed
}
