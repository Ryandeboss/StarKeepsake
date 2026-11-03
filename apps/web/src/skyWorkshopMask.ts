/** Sky-lab mask refinement, independent of UI and AI provider.
 * Never alter original RGB. A conservative initial mask makes restoring
 * delicate trees and skyline details easier.
 */
export function conservativeSkyMask(
  raw: Uint8Array, width:number, height:number, inset=2,
): Uint8Array {
  if(width<=0||height<=0||raw.length!==width*height)
    throw new Error('Sky segmentation dimensions do not match.')
  const seen=new Uint8Array(raw.length)
  const queue=new Int32Array(raw.length)
  let tail=0,head=0
  function enqueue(index:number){
    if(!raw[index]||seen[index])return
    seen[index]=1
    queue[tail++]=index
  }
  for(let x=0;x<width;x++)enqueue(x)
  // Some frames are angled upward behind tree canopies. Keep sky connected
  // to the sides near the top, but never detached islands inside a building.
  for(let y=0;y<Math.floor(height*.32);y++){
    enqueue(y*width);enqueue(y*width+width-1)
  }
  while(head<tail){
    const i=queue[head++],x=i%width,y=(i/width)|0
    if(x>0)enqueue(i-1)
    if(x<width-1)enqueue(i+1)
    if(y>0)enqueue(i-width)
    if(y<height-1)enqueue(i+width)
  }
  if(inset<=0)return seen
  const clean=new Uint8Array(raw.length)
  const radius=Math.max(0,Math.min(5,Math.floor(inset)))
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x
    if(!seen[i])continue
    let protectedEdge=false
    for(let dy=-radius;dy<=radius&&!protectedEdge;dy++){
      const yy=y+dy
      if(yy<0||yy>=height)continue
      for(let dx=-radius;dx<=radius;dx++){
        const xx=x+dx
        if(xx<0||xx>=width)continue
        if(!seen[yy*width+xx]){protectedEdge=true;break}
      }
    }
    if(!protectedEdge)clean[i]=1
  }
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
