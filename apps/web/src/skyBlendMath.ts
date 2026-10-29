import type { DesignStar, DesignRegion } from '../../../contracts/design-spec/design-spec'

export type SkySegmentation = {
  width: number
  height: number
  segmentationMap: Uint8ClampedArray
  skyColor: readonly [number, number, number]
}

export function isSkyPixel(mask: SkySegmentation, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return false
  }
  const px = Math.min(mask.width - 1, Math.floor(x * mask.width))
  const py = Math.min(mask.height - 1, Math.floor(y * mask.height))
  const offset = (py * mask.width + px) * 4
  const data = mask.segmentationMap
  return data[offset] === mask.skyColor[0] &&
    data[offset + 1] === mask.skyColor[1] &&
    data[offset + 2] === mask.skyColor[2]
}

export function hasClearSkyAt(mask: SkySegmentation, x: number, y: number): boolean {
  // Reject boundaries and isolated false positives; avoid placing lights
  // over the detected silhouette of a person, tree or building.
  const deltaX = 2 / mask.width
  const deltaY = 2 / mask.height
  for (const dx of [-deltaX, 0, deltaX]) {
    for (const dy of [-deltaY, 0, deltaY]) {
      if (!isSkyPixel(mask, x + dx, y + dy)) return false
    }
  }
  return true
}

export function skyCoverage(mask: SkySegmentation): number {
  let count = 0
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (isSkyPixel(mask, (x + 0.5) / mask.width, (y + 0.5) / mask.height)) {
        count++
      }
    }
  }
  return count / (mask.width * mask.height)
}

export type SkyBlendPoint = { x: number; y: number; star: DesignStar }
export function selectSkyBlendPoints(
  stars: readonly DesignStar[],
  skyRegion: DesignRegion,
  mask: SkySegmentation,
): SkyBlendPoint[] {
  const result: SkyBlendPoint[] = []
  for (const star of stars) {
    const x = (star.xMm - skyRegion.xMm) / skyRegion.widthMm
    const y = (star.yMm - skyRegion.yMm) / skyRegion.heightMm
    if (hasClearSkyAt(mask, x, y)) result.push({ x, y, star })
  }
  return result
}
