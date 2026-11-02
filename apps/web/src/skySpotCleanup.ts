/**
 * Optional manual repair for white/cloudy patches the semantic mask missed.
 * The user clicks a patch in the full-size preview: RGB-based connected region
 * growing makes that patch transparent, without a second Fal request.
 *
 * This is deliberately local and reversible. Only bright, low-chroma regions
 * above the foreground horizon can be removed; branches are high contrast.
 */
export type SkySpot = Readonly<{ x: number; y: number }>

const luma = (r: number, g: number, b: number) => (77 * r + 150 * g + 29 * b) / 256

export function removeSkySpots(
  original: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  invert: boolean,
  width: number,
  height: number,
  spots: readonly SkySpot[],
): Uint8ClampedArray {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || original.length !== width * height * 4 ||
      mask.length !== original.length) throw new Error('Image and AI mask dimensions must match')

  const output = new Uint8ClampedArray(mask)
  if (!spots.length) return output
  const maxY = Math.min(height, Math.ceil(height * 0.62))
  // One byte per pixel supports the 32-operation editor undo history.
  const visited = new Uint8Array(width * maxY)
  const queue = new Int32Array(width * maxY)

  for (let index = 0; index < spots.length && index < 32; index++) {
    const spot = spots[index]
    const sx = Math.floor(spot.x), sy = Math.floor(spot.y)
    if (!Number.isFinite(sx) || !Number.isFinite(sy) ||
        sx < 0 || sx >= width || sy < 0 || sy >= maxY) continue
    const seed = (sy * width + sx) * 4
    const r = original[seed], g = original[seed + 1], b = original[seed + 2]
    if (luma(r, g, b) < 158 || Math.max(r,g,b) - Math.min(r,g,b) > 90) continue

    const minimumBrightness = Math.max(148, luma(r, g, b) - 46)
    const maxDeltaSq = 83 * 83
    // Each click is limited to an area around its chosen sky pocket. A wrong
    // click should never erase the entire photo or a faraway structure.
    const rangeX = Math.max(24, Math.round(width * 0.30))
    const rangeY = Math.max(20, Math.round(height * 0.33))
    const xmin = Math.max(0, sx - rangeX), xmax = Math.min(width - 1, sx + rangeX)
    const ymin = Math.max(0, sy - rangeY), ymax = Math.min(maxY - 1, sy + rangeY)
    let head = 0, tail = 0
    const generation = index + 1

    function enqueue(x: number, y: number): void {
      if (x < xmin || x > xmax || y < ymin || y > ymax) return
      const p = y * width + x
      if (visited[p] === generation) return
      visited[p] = generation
      const i = p * 4
      const pr = original[i], pg = original[i + 1], pb = original[i + 2]
      if (original[i + 3] < 160 || luma(pr, pg, pb) < minimumBrightness ||
          Math.max(pr,pg,pb) - Math.min(pr,pg,pb) > 92) return
      const dr = pr - r, dg = pg - g, db = pb - b
      if (dr*dr + dg*dg + db*db > maxDeltaSq) return
      queue[tail++] = p
    }

    enqueue(sx, sy)
    while (head < tail) {
      const p = queue[head++]
      const j = p * 4
      const target = invert ? 0 : 255
      output[j] = target
      output[j + 1] = target
      output[j + 2] = target

      const x = p % width, y = (p / width) | 0
      enqueue(x - 1, y)
      enqueue(x + 1, y)
      enqueue(x, y - 1)
      enqueue(x, y + 1)
    }
  }
  return output
}
