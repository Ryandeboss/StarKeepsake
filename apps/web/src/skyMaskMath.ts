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

/** Retain the existing auto-cutout's white-matte RGB cleanup at its edges. */
export function composeSkyCutout(
  original: Uint8ClampedArray,
  autoCutout: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
): Uint8ClampedArray {
  if (original.length !== autoCutout.length || original.length !== alpha.length * 4) {
    throw new Error('Image dimensions do not match')
  }
  const output = new Uint8ClampedArray(original)
  for (let i=0; i<alpha.length; i++) {
    const offset = i*4
    if (alpha[i] <= autoCutout[offset+3]) {
      output[offset] = autoCutout[offset]
      output[offset+1] = autoCutout[offset+1]
      output[offset+2] = autoCutout[offset+2]
    }
    output[offset+3] = alpha[i]
  }
  return output
}
