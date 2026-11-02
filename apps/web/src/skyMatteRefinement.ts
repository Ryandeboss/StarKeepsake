/**
 * Local, non-generative edge refinement for AI sky mattes.
 *
 * The Fal mask classifies sky, but JPEG/resize anti-aliasing frequently leaves
 * 1–8px of sky-colored pixels around branches and roofs. Expanding the sky mask
 * blindly would erase thin branches, so only expand into pixels whose original
 * color resembles a nearby HIGH-CONFIDENCE sky sample.
 *
 * No upload, no additional metered API call, no edits to interior foreground.
 */

export type SkyEdgeOptions = {
  width: number
  height: number
  /** In original image pixels. 0 retains the exact raw mask. */
  cleanupPx: number
  /** Recover foreground RGB for semi-transparent sky-contaminated edges. */
  decontaminate: boolean
}

function skyLuma(mask: Uint8ClampedArray, invert: boolean): Uint8Array {
  const output = new Uint8Array(mask.length / 4)
  for (let p = 0; p < output.length; p++) {
    const i = p * 4
    const luma = Math.round((mask[i] + mask[i + 1] + mask[i + 2]) / 3)
    output[p] = invert ? 255 - luma : luma
  }
  return output
}

/**
 * Square maximum filter in O(width*height) time with a sliding monotonic
 * deque. Used to identify ONLY the narrow sky-adjacent cleanup band.
 */
function maxFilter2D(source: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius === 0) return new Uint8Array(source)
  const intermediate = new Uint8Array(source.length)
  const output = new Uint8Array(source.length)
  const deque = new Int32Array(Math.max(width, height) + radius + 1)

  for (let y = 0; y < height; y++) {
    let head = 0
    let tail = 0
    const base = y * width
    for (let x = 0; x < width + radius; x++) {
      if (x < width) {
        const value = source[base + x]
        while (head < tail && source[base + deque[tail - 1]] <= value) tail--
        deque[tail++] = x
      }
      const outX = x - radius
      if (outX < 0) continue
      while (head < tail && deque[head] < outX - radius) head++
      intermediate[base + outX] = source[base + deque[head]]
    }
  }

  for (let x = 0; x < width; x++) {
    let head = 0
    let tail = 0
    for (let y = 0; y < height + radius; y++) {
      if (y < height) {
        const value = intermediate[y * width + x]
        while (head < tail && intermediate[deque[tail - 1] * width + x] <= value) tail--
        deque[tail++] = y
      }
      const outY = y - radius
      if (outY < 0) continue
      while (head < tail && deque[head] < outY - radius) head++
      output[outY * width + x] = intermediate[deque[head] * width + x]
    }
  }

  return output
}

type SkySample = { r: number; g: number; b: number }

/** Get closest original pixel that the AI is confident is genuine sky. */
function closestSkySample(
  rgb: Uint8ClampedArray, sky: Uint8Array,
  width: number, height: number, px: number, radius: number,
): SkySample | null {
  const x = px % width
  const y = Math.floor(px / width)
  let nearest = Infinity
  let best = -1
  for (let dy = -radius; dy <= radius; dy++) {
    const sy = y + dy
    if (sy < 0 || sy >= height) continue
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = x + dx
      if (sx < 0 || sx >= width) continue
      const pos = sy * width + sx
      if (sky[pos] < 225) continue
      const distance = dx * dx + dy * dy
      if (distance >= nearest) continue
      nearest = distance
      best = pos
    }
  }
  if (best < 0) return null
  const i = best * 4
  return { r: rgb[i], g: rgb[i + 1], b: rgb[i + 2] }
}

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)))
}

export function refineSkyAlpha(
  original: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  invert = false,
  options?: SkyEdgeOptions,
): Uint8ClampedArray {
  if (original.length !== mask.length || original.length % 4 !== 0) {
    throw new Error('Image and AI mask dimensions must match')
  }
  if (options && (
    !Number.isSafeInteger(options.width) || !Number.isSafeInteger(options.height) ||
    options.width <= 0 || options.height <= 0 ||
    options.width * options.height * 4 !== original.length
  )) {
    throw new Error('Image and AI mask dimensions must match')
  }

  const result = new Uint8ClampedArray(original)
  const sky = skyLuma(mask, invert)
  const radius = options ? Math.min(8, Math.max(0, Math.round(options.cleanupPx))) : 0
  const extended = radius && options ? maxFilter2D(sky, options.width, options.height, radius) : sky

  for (let p = 0; p < sky.length; p++) {
    const i = p * 4
    let skyCoverage = sky[p]
    let sample: SkySample | null = null

    if (options && radius && extended[p] > skyCoverage) {
      // Check actual original color before eating into the subject. The
      // max-filter can cross narrow branches: dark wood against bright sky
      // must survive even when surrounded by sky on both sides.
      sample = closestSkySample(original, sky, options.width, options.height, p, radius)
      if (sample) {
        const dr = Math.abs(original[i] - sample.r)
        const dg = Math.abs(original[i + 1] - sample.g)
        const db = Math.abs(original[i + 2] - sample.b)
        const colorDelta = Math.max(dr, dg, db)

        // Fully preserve clearly different foreground colors, even when
        // they are only one pixel wide. Partial transparency for subtle
        // antialiased edges, full removal for sky-colored spill.
        const affinity = Math.min(1, Math.max(0, (100 - colorDelta) / 70))
        skyCoverage = Math.max(skyCoverage,
          Math.round(skyCoverage + (extended[p] - skyCoverage) * affinity))
      }
    }

    const opacity = 255 - skyCoverage
    result[i + 3] = Math.round(original[i + 3] * opacity / 255)

    // RGB decontamination is restricted to semi-transparent pixels around
    // the AI-identified edge. Fully opaque buildings remain bit-for-bit
    // identical. A near-transparent pixel is made transparent rather than
    // amplifying JPEG noise when unmatted.
    if (options?.decontaminate && result[i + 3] > 0 &&
      result[i + 3] < 245 && skyCoverage > 0) {
      if (!sample) {
        sample = closestSkySample(original, sky, options.width, options.height, p,
          Math.max(2, radius + 1))
      }
      if (sample) {
        const foregroundCoverage = result[i + 3] / 255
        if (foregroundCoverage < 0.09) {
          result[i + 3] = 0
        } else {
          const bg = [sample.r, sample.g, sample.b]
          for (let channel = 0; channel < 3; channel++) {
            // Original JPEG RGB is a foreground+sky mixture. Approximate
            // unmatting only here, after coverage is established.
            result[i + channel] = clampByte(
              (original[i + channel] - (1 - foregroundCoverage) * bg[channel]) /
              foregroundCoverage,
            )
          }
        }
      }
    }
  }

  return result
}
