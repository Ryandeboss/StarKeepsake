/** Size a photo frame INSIDE a panoramic sky viewport without cropping portraits. */
export type PhotoFrameRatio = 'original' | '9:16' | '4:5' | '3:4' | '1:1' | '4:3' | '16:9'
export type PhotoStarPlacement = 'cutout' | 'upper' | 'whole'

export const PHOTO_FRAME_RATIOS: ReadonlyArray<{ id: PhotoFrameRatio; label: string; description: string }> = [
  { id: 'original', label: 'Original', description: 'Fit photo' },
  { id: '9:16', label: '9:16', description: 'Story' },
  { id: '4:5', label: '4:5', description: 'Portrait' },
  { id: '3:4', label: '3:4', description: 'Classic' },
  { id: '1:1', label: '1:1', description: 'Square' },
  { id: '4:3', label: '4:3', description: 'Landscape' },
  { id: '16:9', label: '16:9', description: 'Wide' },
]

export function photoFrameAspect(
  ratio: PhotoFrameRatio, sourceWidth: number, sourceHeight: number,
): number {
  if (ratio === 'original') {
    if (!(sourceWidth > 0 && sourceHeight > 0)) return 1
    return sourceWidth / sourceHeight
  }
  const [w, h] = ratio.split(':').map(Number)
  return w / h
}

export function containPhotoFrame(
  viewportWidth: number,
  viewportHeight: number,
  frameAspect: number,
  padding = 0.94,
): { width: number; height: number } {
  if (!(viewportWidth > 0 && viewportHeight > 0 && frameAspect > 0)) {
    return { width: 0, height: 0 }
  }
  const widthLimit = viewportWidth * padding
  const heightLimit = viewportHeight * padding
  const height = Math.min(heightLimit, widthLimit / frameAspect)
  return { width: height * frameAspect, height }
}
