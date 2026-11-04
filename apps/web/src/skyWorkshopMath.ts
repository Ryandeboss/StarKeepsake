/** Pure image-space geometry shared by the AI mask and the hand-editing studio. */
export type SkyAlphaMask = {
  width: number
  height: number
  alpha: Uint8ClampedArray
}

/** Resize the AI model's coarse semantic mask to the editor working image.
 * Nearest neighbor preserves foreground silhouettes without inventing fuzzy edges.
 */
export function resampleSkyAlpha(
  mask: SkyAlphaMask, width: number, height: number,
): Uint8ClampedArray {
  if (!mask.width || !mask.height || mask.alpha.length !== mask.width*mask.height ||
      width <= 0 || height <= 0) throw new Error('Invalid sky-mask dimensions.')
  if (width*height > 10_000_000) throw new Error('Sky-mask preview is too large.')
  const next = new Uint8ClampedArray(width * height)
  for (let y=0; y<height; y++) {
    const sy = Math.min(mask.height-1, Math.floor((y+.5)*mask.height/height))
    for (let x=0; x<width; x++) {
      const sx = Math.min(mask.width-1, Math.floor((x+.5)*mask.width/width))
      next[y*width+x] = mask.alpha[sy*mask.width+sx]
    }
  }
  return next
}

export function wrapWorkshopHeading(heading: number): number {
  return ((heading % 360) + 360) % 360
}
export function clampWorkshopPitch(pitch: number): number {
  return Math.max(-8, Math.min(88, pitch))
}

/** A contain-fitted picture occupies exactly this inset; star fields are
 * never allowed to leak into unused frame margins.
 */
export function containWorkshopPhoto(
  width: number, height: number, aspect: number,
): {left:number;top:number;width:number;height:number} {
  if (width<=0||height<=0||aspect<=0) return {left:0,top:0,width:0,height:0}
  const photoWidth = Math.min(width, height * aspect)
  const photoHeight = photoWidth / aspect
  return {left:(width-photoWidth)/2,top:(height-photoHeight)/2,
    width:photoWidth,height:photoHeight}
}

/** Convert 1000x600 observer coordinates into the visible photo panel.
 * CSS/SVG both center-crop a photographic 5:3 viewport, preserving round
 * star optics instead of stretching them on portrait frames.
 */
export function observerPointInPanel(
  x:number, y:number, panelAspect:number,
): {x:number;y:number;inside:boolean} {
  if(!Number.isFinite(panelAspect)||panelAspect<=0)
    return {x:0,y:0,inside:false}
  const sourceAspect=1000/600
  const visibleWidth=panelAspect<sourceAspect?600*panelAspect:1000
  const visibleHeight=panelAspect>sourceAspect?1000/panelAspect:600
  const nx=(x-(1000-visibleWidth)/2)/visibleWidth
  const ny=(y-(600-visibleHeight)/2)/visibleHeight
  return {x:nx,y:ny,inside:nx>=0&&nx<=1&&ny>=0&&ny<=1}
}
