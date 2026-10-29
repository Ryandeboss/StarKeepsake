import type { CSSProperties } from 'react'
import type { PhotoCrop } from './designSpec'

export const FULL_PHOTO_CROP: PhotoCrop = { x: 0, y: 0, width: 1, height: 1 }

export function getCoverCrop(sourceWidth: number, sourceHeight: number, aspect: number): PhotoCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0 || aspect <= 0) return FULL_PHOTO_CROP
  const imageAspect = sourceWidth / sourceHeight
  const width = Math.min(1, aspect / imageAspect)
  const height = Math.min(1, imageAspect / aspect)
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height }
}

export function clampCrop(crop: PhotoCrop): PhotoCrop {
  const width = Math.min(1, Math.max(0.001, crop.width))
  const height = Math.min(1, Math.max(0.001, crop.height))
  return {
    x: Math.min(1 - width, Math.max(0, crop.x)),
    y: Math.min(1 - height, Math.max(0, crop.y)),
    width,
    height,
  }
}

export function croppedImageStyle(crop: PhotoCrop): CSSProperties {
  return {
    position: 'absolute',
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    maxWidth: 'none',
    objectFit: 'fill',
  }
}
