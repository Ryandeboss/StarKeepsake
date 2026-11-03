import type { DesignSpec } from './designSpec'
import type { AbovePhotoFitMode } from './photoSkyLayout'

export type { AbovePhotoFitMode } from './photoSkyLayout'
export const SKY_SPLIT_MIN = 20
export const SKY_SPLIT_MAX = 70
export const DEFAULT_SKY_SPLIT = 38
export const DEFAULT_PHOTO_FIT: AbovePhotoFitMode = 'center-crop'

/**
 * Preview-only proportion adjustment. Star IDs, catalog coordinates, time and
 * altitude are untouched; only their mm display positions are reprojected.
 * The backend engine remains authoritative for future production artwork.
 */
export function withSkyPhotoBalance(
  spec: DesignSpec, skyPercent: number,
): DesignSpec {
  const { sky, engravingPhoto, text } = spec.regions
  const end = Math.min(text.yMm - 2, engravingPhoto.yMm + engravingPhoto.heightMm)
  const total = end - sky.yMm
  if (!Number.isFinite(skyPercent) || total <= 20 || sky.heightMm <= 0) return spec
  const gap = Math.min(8, Math.max(3, total * .022))
  const usable = total - gap
  const split = Math.min(SKY_SPLIT_MAX, Math.max(SKY_SPLIT_MIN, skyPercent)) / 100
  const nextSkyHeight = usable * split
  const nextPhotoY = sky.yMm + nextSkyHeight + gap
  const nextPhotoHeight = usable - nextSkyHeight
  const regions = {
    ...spec.regions,
    sky: { ...sky, heightMm: nextSkyHeight },
    engravingPhoto: { ...engravingPhoto, yMm: nextPhotoY, heightMm: nextPhotoHeight },
  }
  return {
    ...spec, regions,
    photo: { ...spec.photo, positionMm: { xMm: regions.engravingPhoto.xMm, yMm: regions.engravingPhoto.yMm,
      widthMm: regions.engravingPhoto.widthMm, heightMm: regions.engravingPhoto.heightMm } },
    stars: spec.stars.map(star => ({
      ...star, yMm: sky.yMm + (star.yMm - sky.yMm) * (nextSkyHeight / sky.heightMm),
    })),
  }
}

export function photoFitStyle(mode: AbovePhotoFitMode): {
  objectFit: 'contain' | 'cover' | 'fill'; objectPosition: string
} {
  switch (mode) {
    case 'fit': return { objectFit: 'contain', objectPosition: 'center center' }
    case 'top-crop': return { objectFit: 'cover', objectPosition: 'center bottom' }
    case 'bottom-crop': return { objectFit: 'cover', objectPosition: 'center top' }
    case 'stretch': return { objectFit: 'fill', objectPosition: 'center center' }
    default: return { objectFit: 'cover', objectPosition: 'center center' }
  }
}
