/**
 * Bulk, user-selected sky touch-up. One rectangle can recover hundreds of
 * disconnected white/cloud-colored gaps, using ORIGINAL photo RGB.
 *
 * Strict bounds: every changed mask pixel lies inside the dragged rectangle
 * and (by default) above the protected lower-photo band. This is intentionally not
 * unrestricted magic wand; review the result for pale buildings.
 *
 * The function runs entirely in the browser, never re-requests Fal.
 */
export type SkySweepRectangle = Readonly<{
  x0: number
  y0: number
  x1: number
  y1: number
}>

const brightness = (r: number, g: number, b: number): number =>
  (77 * r + 150 * g + 29 * b) / 256

export function removeSkySweeps(
  original: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  invert: boolean,
  width: number,
  height: number,
  rectangles: readonly SkySweepRectangle[],
  protectLowerImage = true,
): Uint8ClampedArray {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 ||
      original.length !== width * height * 4 || mask.length !== original.length) {
    throw new Error('Image and AI mask dimensions must match')
  }

  const output = new Uint8ClampedArray(mask)
  const safeBottom = protectLowerImage ? Math.ceil(height * 0.62) : height
  if (!rectangles.length) return output
  // Bulk operations have their own lightweight, independent undo history.
  for (const rect of rectangles.slice(0, 32)) {
    if (![rect.x0, rect.y0, rect.x1, rect.y1].every(Number.isFinite)) continue
    const left = Math.max(0, Math.min(width, Math.floor(Math.min(rect.x0, rect.x1))))
    const top = Math.max(0, Math.min(safeBottom, Math.floor(Math.min(rect.y0, rect.y1))))
    const right = Math.max(0, Math.min(width, Math.ceil(Math.max(rect.x0, rect.x1))))
    const bottom = Math.max(0, Math.min(safeBottom, Math.ceil(Math.max(rect.y0, rect.y1))))
    const w = right - left
    const h = bottom - top
    if (w < 3 || h < 3) continue

    // Use only pixels within the user-selected area. This is more precise
    // than a connected flood which can leak out of the selected rectangle.
    const seen = new Uint8Array(w * h)
    const queue = new Int32Array(w * h)
    const minComponentPixels = 2

    function eligible(local: number): boolean {
      const x = local % w
      const y = Math.floor(local / w)
      const p = ((top + y) * width + left + x) * 4
      const r = original[p], g = original[p + 1], b = original[p + 2]
      if (original[p + 3] < 160 || brightness(r, g, b) < 172) return false
      if (Math.max(r, g, b) - Math.min(r, g, b) > 74) return false
      // Skip pixels already considered transparent sky by the union mask.
      const providerBrightness = (output[p] + output[p + 1] + output[p + 2]) / 3
      const sky = invert ? 255 - providerBrightness : providerBrightness
      return sky < 235
    }

    for (let start = 0; start < w * h; start++) {
      if (seen[start]) continue
      seen[start] = 1
      if (!eligible(start)) continue

      // Each bright component is independent. Dark, differently colored
      // branch pixels split components; one drag handles all of them.
      let head = 0
      let tail = 1
      queue[0] = start
      while (head < tail) {
        const p = queue[head++]
        const x = p % w
        const y = Math.floor(p / w)
        function add(n: number) {
          if (seen[n]) return
          seen[n] = 1
          if (eligible(n)) queue[tail++] = n
        }
        if (x > 0) add(p - 1)
        if (x + 1 < w) add(p + 1)
        if (y > 0) add(p - w)
        if (y + 1 < h) add(p + w)
      }

      if (tail < minComponentPixels) continue
      for (let i = 0; i < tail; i++) {
        const local = queue[i]
        const x = local % w
        const y = Math.floor(local / w)
        const p = ((top + y) * width + left + x) * 4
        const skyByte = invert ? 0 : 255
        output[p] = skyByte
        output[p + 1] = skyByte
        output[p + 2] = skyByte
      }
    }
  }
  return output
}
