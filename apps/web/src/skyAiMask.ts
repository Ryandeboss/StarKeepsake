/**
 * Composites an AI *sky-only segmentation mask* over original RGB pixels.
 * No generative reconstruction is performed; buildings and tree detail are
 * copied unchanged wherever the model classifies foreground.
 *
 * Segmentation convention: WHITE = sky, BLACK = foreground. A user can invert
 * the mask for unusual provider outputs.
 */
export function applySkyAlpha(
  original: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  invert = false,
): Uint8ClampedArray {
  if (original.length !== mask.length || original.length % 4 !== 0) {
    throw new Error('Image and AI mask dimensions must match')
  }
  const result = new Uint8ClampedArray(original)
  for (let i=0; i<original.length; i+=4) {
    const brightness = (mask[i] + mask[i+1] + mask[i+2]) / 3 / 255
    const sky = invert ? 1 - brightness : brightness
    // Premultiply with original alpha to support user's pre-cut PNG.
    result[i+3] = Math.round(original[i+3] * (1 - sky))
  }
  return result
}

export function maskLooksUsable(mask: Uint8ClampedArray): boolean {
  if (mask.length < 4 || mask.length % 4 !== 0) return false
  let sky = 0
  for (let i=0; i<mask.length; i+=4) {
    if ((mask[i]+mask[i+1]+mask[i+2])/3 > 128) sky++
  }
  const proportion = sky / (mask.length/4)
  // Refuse completely empty/full segmentation; preserve original on failure.
  return proportion > .005 && proportion < .95
}
