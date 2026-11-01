/**
 * White-sky removal for foreground-only photo plates.
 * Intended for artificial white/near-white backgrounds such as the supplied
 * Chicago JPG. Flooding from the top avoids erasing bright building windows.
 */
export function maskWhiteSkyPixels(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (pixels.length !== width * height * 4) throw new Error('Image buffer dimensions do not match')
  const count = width * height
  const result = new Uint8ClampedArray(pixels)
  const visited = new Uint8Array(count)
  const queue = new Int32Array(count)
  let head = 0
  let tail = 0

  function isWhite(i: number) {
    const offset = i * 4
    return pixels[offset] >= 244 && pixels[offset + 1] >= 244 && pixels[offset + 2] >= 244
  }
  function enqueue(i: number) {
    if (visited[i] || !isWhite(i)) return
    visited[i] = 1
    queue[tail++] = i
  }

  for (let x = 0; x < width; x++) enqueue(x)

  while (head < tail) {
    const i = queue[head++]
    const x = i % width
    const y = (i / width) | 0
    if (x > 0) enqueue(i - 1)
    if (x + 1 < width) enqueue(i + 1)
    if (y > 0) enqueue(i - width)
    if (y + 1 < height) enqueue(i + width)
  }

  for (let i = 0; i < count; i++) {
    const offset = i * 4
    if (visited[i]) {
      result[offset] = 0
      result[offset + 1] = 0
      result[offset + 2] = 0
      result[offset + 3] = 0
      continue
    }

    const x = i % width
    const y = (i / width) | 0
    const touchesSky = (x > 0 && visited[i - 1]) ||
      (x + 1 < width && visited[i + 1]) ||
      (y > 0 && visited[i - width]) ||
      (y + 1 < height && visited[i + width])
    if (!touchesSky) continue

    // Recover a soft anti-aliased boundary from the JPG's white matte.
    const darkest = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2])
    const alpha = Math.max(0.02, Math.min(1, (255 - darkest) / 42))
    result[offset + 3] = Math.round(alpha * 255)
    for (let channel = 0; channel < 3; channel++) {
      result[offset + channel] = Math.max(0, Math.min(255,
        Math.round((pixels[offset + channel] - (1 - alpha) * 255) / alpha)))
    }
  }
  return result
}

export function hasTransparentSky(pixels: Uint8ClampedArray): boolean {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 240) return true
  }
  return false
}

/** Uses a browser-owned canvas; no customer image is uploaded anywhere. */
export async function createSkylineCutout(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width < 600 || bitmap.width / bitmap.height < 1.4) {
      throw new Error('Choose a landscape Chicago skyline image, at least 600 pixels wide.')
    }
    const scale = Math.min(1, 3000 / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('The browser could not prepare the skyline image.')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const input = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if (!hasTransparentSky(input.data)) {
      const masked = maskWhiteSkyPixels(input.data, canvas.width, canvas.height)
      ctx.putImageData(new ImageData(masked, canvas.width, canvas.height), 0, 0)
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export the skyline cutout.')), 'image/png'))
  } finally {
    bitmap.close()
  }
}
