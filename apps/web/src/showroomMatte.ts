/** Deterministic color-keying for customer-provided green-screen plates.
 * This runs ONCE per selected plate, on a local image in the browser.
 * Only the plate's green is removed: the customer's uploaded photo and
 * astronomical stars are never sampled or altered by this function.
 */
export function removeGreenScreen(input:Uint8ClampedArray,w:number,h:number):
  Uint8ClampedArray {
  if(w<=0||h<=0||input.length!==w*h*4)throw Error('Invalid plate pixels.')
  const out=new Uint8ClampedArray(input)
  const primary=new Uint8Array(w*h)
  for(let i=0;i<primary.length;i++){
    const j=i*4,r=input[j],g=input[j+1],b=input[j+2]
    if(g>125&&g>r*1.22&&g>b*1.22&&g-Math.max(r,b)>30)primary[i]=1
  }
  // Extend removal by one pixel to absorb antialiased lime fringes.
  // Only pixels with a green tint at the actual boundary are affected.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,j=i*4
    if(primary[i]){out[j+3]=0;continue}
    const r=input[j],g=input[j+1],b=input[j+2]
    if(g<100||g<=r+8||g<=b+8)continue
    let neighbor=false
    for(let dy=-1;dy<=1&&!neighbor;dy++){
      const yy=y+dy;if(yy<0||yy>=h)continue
      for(let dx=-1;dx<=1;dx++){
        const xx=x+dx;if(xx<0||xx>=w)continue
        if(primary[yy*w+xx]){neighbor=true;break}
      }
    }
    if(neighbor)out[j+3]=0
  }
  return out
}
