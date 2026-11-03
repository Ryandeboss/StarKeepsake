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
