import { refineSkyAlpha, type SkyEdgeOptions } from './skyMatteRefinement'

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
  edgeOptions?: SkyEdgeOptions,
): Uint8ClampedArray {
  return refineSkyAlpha(original, mask, invert, edgeOptions)
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
