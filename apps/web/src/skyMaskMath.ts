/**
 * Non-destructive alpha editing for a skyline photo.
 * All decisions use the ORIGINAL RGB pixels so a removed region can be restored.
 * Operations are independent of React and suitable for regression tests.
 */
export function colorRegion(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number,
  contiguous: boolean,
): Uint8Array {
  if (pixels.length !== width * height * 4) throw new Error('Image dimensions do not match')
  const selected = new Uint8Array(width * height)
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return selected
  const seed = startY * width + startX
  const seedOffset = seed * 4
  const red = pixels[seedOffset]
  const green = pixels[seedOffset + 1]
  const blue = pixels[seedOffset + 2]
  const threshold = Math.max(0, Math.min(255, tolerance))
  const matches = (index: number) => {
    const offset = index * 4
    return Math.max(
      Math.abs(pixels[offset] - red),
      Math.abs(pixels[offset + 1] - green),
      Math.abs(pixels[offset + 2] - blue),
    ) <= threshold
  }

  if (!contiguous) {
    for (let i = 0; i < selected.length; i++) if (matches(i)) selected[i] = 1
    return selected
  }

  const visited = new Uint8Array(selected.length)
  const queue = new Int32Array(selected.length)
  let head = 0
  let tail = 1
  queue[0] = seed
  visited[seed] = 1
  while (head < tail) {
    const index = queue[head++]
    if (!matches(index)) continue
    selected[index] = 1
    const x = index % width
    const y = (index / width) | 0
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < width ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y + 1 < height ? index + width : -1,
    ]
    for (const next of neighbors) {
      if (next < 0 || visited[next]) continue
      visited[next] = 1
      queue[tail++] = next
    }
  }
  return selected
}

export function changeRegionAlpha(
  alpha: Uint8ClampedArray,
  selected: Uint8Array,
  original: Uint8ClampedArray,
  restore: boolean,
): number {
  if (alpha.length !== selected.length || original.length !== alpha.length * 4) {
    throw new Error('Image dimensions do not match')
  }
  let changed = 0
  for (let i = 0; i < alpha.length; i++) {
    if (!selected[i]) continue
    const next = restore ? original[i * 4 + 3] : 0
    if (alpha[i] !== next) { alpha[i] = next; changed++ }
  }
  return changed
}

export function paintAlphaLine(
  alpha: Uint8ClampedArray,
  original: Uint8ClampedArray,
  width: number,
  height: number,
  x1: number, y1: number, x2: number, y2: number,
  radius: number,
  restore: boolean,
): void {
  const r = Math.max(1, radius)
  const distance = Math.hypot(x2-x1, y2-y1)
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, r / 2)))
  for (let step = 0; step <= steps; step++) {
    const t = step / steps
    const x = x1 + (x2-x1)*t
    const y = y1 + (y2-y1)*t
    for (let py = Math.max(0, Math.floor(y-r)); py <= Math.min(height-1, Math.ceil(y+r)); py++) {
      for (let px = Math.max(0, Math.floor(x-r)); px <= Math.min(width-1, Math.ceil(x+r)); px++) {
        if ((px-x)**2 + (py-y)**2 > r*r) continue
        const index = py*width + px
        alpha[index] = restore ? original[index*4+3] : 0
      }
    }
  }
}

export type MaskPoint = { x: number; y: number }

export function fillMaskPolygon(
  alpha: Uint8ClampedArray,
  original: Uint8ClampedArray,
  width: number,
  height: number,
  vertices: MaskPoint[],
  restore: boolean,
): number {
  if (vertices.length < 3) return 0
  const xMin = Math.max(0, Math.floor(Math.min(...vertices.map(point => point.x))))
  const xMax = Math.min(width-1, Math.ceil(Math.max(...vertices.map(point => point.x))))
  const yMin = Math.max(0, Math.floor(Math.min(...vertices.map(point => point.y))))
  const yMax = Math.min(height-1, Math.ceil(Math.max(...vertices.map(point => point.y))))
  let changed = 0
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      let inside = false
      for (let i=0, j=vertices.length-1; i<vertices.length; j=i++) {
        const a = vertices[i], b = vertices[j]
        if ((a.y > y) !== (b.y > y) &&
            x < (b.x-a.x) * (y-a.y) / (b.y-a.y) + a.x) inside = !inside
      }
      if (!inside) continue
      const index = y * width + x
      const next = restore ? original[index*4+3] : 0
      if (alpha[index] !== next) { alpha[index] = next; changed++ }
    }
  }
  return changed
}

export function getAlpha(pixels: Uint8ClampedArray): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(pixels.length / 4)
  for (let i=0; i<alpha.length; i++) alpha[i] = pixels[i*4+3]
  return alpha
}

/** Replace pale RGB contamination at the immediate sky/foreground boundary.
 * Unlike blanket erosion, this preserves dark branches and genuine white
 * objects: only near-transparent neighbors with a darker interior anchor
 * are corrected. Restored white sky pixels preserve their original RGB.
 */
export function decontaminateWhiteFringe(
  source: Uint8ClampedArray,
  result: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  width: number, height: number,
  autoCutout?: Uint8ClampedArray,
): Uint8ClampedArray {
  if(width<=0||height<=0||source.length!==width*height*4||
     result.length!==source.length||alpha.length!==width*height)
    throw new Error('Image dimensions do not match')

  const corrected=new Uint8ClampedArray(result)
  const steps=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
  const lum=(j:number)=>(77*source[j]+150*source[j+1]+29*source[j+2])/256
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,j=i*4
    if(alpha[i]<36)continue
    // An explicitly restored region should stay bit-identical to its source.
    if(autoCutout && alpha[i]>autoCutout[j+3])continue
    const edgeBrightness=lum(j)
    const chroma=Math.max(source[j],source[j+1],source[j+2])-
      Math.min(source[j],source[j+1],source[j+2])
    if(edgeBrightness<145||chroma>80)continue

    let target=-1,closest=Infinity
    let backedByBrightInterior=false
    // Inspect the sky-side direction, then sample several pixels inward.
    // A real white structure has bright pixels behind its boundary, even
    // though other diagonal directions might point at a dark nearby tree.
    for(const [dx,dy] of steps){
      const sx=x+dx,sy=y+dy
      if(sx<0||sx>=width||sy<0||sy>=height||alpha[sy*width+sx]>36)continue
      for(let k=2;k<=5;k++){
        const ix=x-dx*k,iy=y-dy*k
        if(ix<0||ix>=width||iy<0||iy>=height)break
        const ii=iy*width+ix
        if(alpha[ii]<250)continue
        const delta=edgeBrightness-lum(ii*4)
        if(delta<18){backedByBrightInterior=true;break}
        if(delta>24 && k<closest){target=ii;closest=k}
        break
      }
    }
    if(target<0 || backedByBrightInterior)continue
    const t=target*4
    const difference=edgeBrightness-lum(t)
    // Stronger decontamination for brighter halos; keep real edge texture.
    const mix=Math.min(.78,Math.max(.25,(difference-16)/110))
    for(let channel=0;channel<3;channel++){
      corrected[j+channel]=Math.round(result[j+channel]*(1-mix)+source[t+channel]*mix)
    }
  }
  return corrected
}

/** Retain previous auto-cutout RGB cleanup and decontaminate the bright
 * hairline left against the replacement dark sky. The original is never
 * modified, and manual Restore always uses the original photo pixels.
 */
export function composeSkyCutout(
  original: Uint8ClampedArray,
  autoCutout: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  width?: number, height?: number,
): Uint8ClampedArray {
  if (original.length !== autoCutout.length || original.length !== alpha.length * 4) {
    throw new Error('Image dimensions do not match')
  }
  const output = new Uint8ClampedArray(original)
  for (let i=0;i<alpha.length;i++){
    const j=i*4
    if(alpha[i]<=autoCutout[j+3]){
      output[j]=autoCutout[j]
      output[j+1]=autoCutout[j+1]
      output[j+2]=autoCutout[j+2]
    }
    output[j+3]=alpha[i]
  }
  if(width!==undefined && height!==undefined){
    return decontaminateWhiteFringe(original,output,alpha,width,height,autoCutout)
  }
  return output
}

/** Full-image local editor, landscape or portrait. Preserve aspect ratio while
 * limiting the working canvas and preventing excessive allocations. */
export function maskWorkingDimensions(
  originalWidth: number, originalHeight: number,
  maxSide = 2600,
): { width: number; height: number } {
  if (!Number.isFinite(originalWidth) || !Number.isFinite(originalHeight) ||
      originalWidth <= 0 || originalHeight <= 0 ||
      originalWidth * originalHeight > 50_000_000) {
    throw new Error('Choose a valid photo under 50 megapixels.')
  }
  const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight))
  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  }
}
