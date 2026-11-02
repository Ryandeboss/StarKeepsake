/**
 * Browser-only bright-sky recovery for a previously generated Fal/SAM sky mask.
 *
 * Large flat white sky patches (especially around thin tree branches) can be
 * missed by semantic segmentation. Recover them by growing only through pixels
 * that resemble high-confidence bright sky from the ORIGINAL image.
 *
 * Sources: top edge, upper side edges, and existing confident sky in the upper
 * part of the image. These seeds help with tree canopies that touch the left
 * photo border but not the top. Growth never crosses dark branches.
 *
 * This changes only a fresh mask buffer. It never calls the AI service.
 */

export type MissedSkyStrength = 0 | 1 | 2 | 3

export type MissedSkyRecoveryOptions = {
  width: number
  height: number
  strength: MissedSkyStrength
  topBandRows?: number
  maxStartSamples?: number
}

const STRENGTH = [
  { minLuma: 256, maxDistance: 0 },
  { minLuma: 185, maxDistance: 28 },
  { minLuma: 170, maxDistance: 40 },
  { minLuma: 155, maxDistance: 55 },
] as const

const rgbLuma = (r: number, g: number, b: number): number =>
  (77 * r + 150 * g + 29 * b) / 256

function median(values: number[]): number {
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]
}

/**
 * Return a separately allocated provider-orientation RGBA mask.
 * Inverted masks remain inverted so the existing compositor can still apply
 * its invert toggle once. Strength 0 returns unchanged bytes.
 */
export function recoverMissedSkyMask(
  original: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  invert: boolean,
  options: MissedSkyRecoveryOptions,
): Uint8ClampedArray {
  const { width, height, strength } = options
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width * height * 4 !== original.length ||
      original.length !== mask.length) {
    throw new Error('Image and AI mask dimensions must match')
  }
  if (![0, 1, 2, 3].includes(strength)) {
    throw new Error('Invalid sky recovery strength')
  }
  const result = new Uint8ClampedArray(mask)
  if (strength === 0) return result

  // Intentionally no flood below ~58% of the image: buildings, beach and
  // water are never considered candidates for recovery.
  const maxRows = Math.min(height, Math.max(1, Math.ceil(height * 0.58)))
  const topBandRows = Math.min(maxRows, Math.max(1,
    Math.floor(options.topBandRows ?? Math.max(2, Math.min(24, height * 0.06)))))
  const maxSamples = Math.min(2048, Math.max(4, Math.floor(options.maxStartSamples ?? 640)))
  const confSky = (p: number): number => {
    const i = p * 4
    const confidence = (mask[i] + mask[i + 1] + mask[i + 2]) / 3
    return invert ? 255 - confidence : confidence
  }
  const minReferenceLuma = 165
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const sample = (p: number): void => {
    if (rs.length >= maxSamples || confSky(p) < 215) return
    const i = p * 4
    const r = original[i], g = original[i + 1], b = original[i + 2]
    if (original[i + 3] < 200 || rgbLuma(r, g, b) < minReferenceLuma) return
    rs.push(r); gs.push(g); bs.push(b)
  }

  // Sample across the upper photo, not just corners (which can contain
  // buildings/branches). Only already-confident AI sky provides references.
  const step = Math.max(1, Math.floor(Math.sqrt(width * topBandRows / maxSamples)))
  for (let y = 0; y < topBandRows && rs.length < maxSamples; y += step) {
    for (let x = 0; x < width && rs.length < maxSamples; x += step) {
      sample(y * width + x)
    }
  }
  // Fallback for panoramas where the top edge is almost all tree canopy.
  if (rs.length < 8) {
    const stride = Math.max(1, Math.floor(width * maxRows / maxSamples))
    for (let p = 0; p < width * maxRows && rs.length < maxSamples; p += stride) {
      sample(p)
    }
  }
  if (rs.length < 4) return result // no trustworthy bright sky reference

  const skyR = median(rs), skyG = median(gs), skyB = median(bs)
  const threshold = STRENGTH[strength]
  const maxDistSq = threshold.maxDistance ** 2
  const count = width * maxRows
  const visited = new Uint8Array(count)
  const queue = new Int32Array(count)
  let head = 0, tail = 0

  // We never enqueue dark or strongly differently colored regions. Treat the
  // model's own confident sky as a seed only if its ORIGINAL RGB matches
  // this same white/bright sky model; no path can jump across branches.
  function qualifies(p: number): boolean {
    const i = p * 4
    if (original[i + 3] < 200) return false
    const r = original[i], g = original[i + 1], b = original[i + 2]
    if (rgbLuma(r, g, b) < threshold.minLuma) return false
    const dr = r - skyR, dg = g - skyG, db = b - skyB
    return dr * dr + dg * dg + db * db <= maxDistSq
  }

  function enqueue(p: number): void {
    if (p < 0 || p >= count || visited[p]) return
    visited[p] = 1
    if (qualifies(p)) queue[tail++] = p
  }

  // Top-connected bright sky, plus upper-left and upper-right edges: the
  // supplied Chicago tree canopy has missing sky open to the left border.
  for (let x = 0; x < width; x++) enqueue(x)
  for (let y = 1; y < Math.min(maxRows, Math.ceil(height * 0.50)); y++) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }

  // AI high-confidence sky acts as extra seed for holes which touch a
  // segmented sky region but are disconnected from the photo border.
  // These are still color-gated and cannot cross wood or facades.
  for (let p = 0; p < count; p++) {
    if (confSky(p) >= 235) enqueue(p)
  }

  while (head < tail) {
    const p = queue[head++]
    const x = p % width
    const y = (p / width) | 0
    if (x > 0) enqueue(p - 1)
    if (x + 1 < width) enqueue(p + 1)
    if (y > 0) enqueue(p - width)
    if (y + 1 < maxRows) enqueue(p + width)
  }

  // Union with the existing model mask, without touching any original RGB.
  // Matte pixels are RGB grayscale; preserve their existing A channel.
  for (let k = 0; k < tail; k++) {
    const i = queue[k] * 4
    const target = invert ? 0 : 255
    if (invert) {
      result[i] = Math.min(result[i], target)
      result[i + 1] = Math.min(result[i + 1], target)
      result[i + 2] = Math.min(result[i + 2], target)
    } else {
      result[i] = Math.max(result[i], target)
      result[i + 1] = Math.max(result[i + 1], target)
      result[i + 2] = Math.max(result[i + 2], target)
    }
  }
  return result
}
