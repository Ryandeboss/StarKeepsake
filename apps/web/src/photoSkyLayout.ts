/**
 * The outer digital frame retains a stable aspect ratio as the sky/photo
 * balance moves. At the default 38% split, the lower photo fits without
 * cropping. Other splits use the selected fit/crop treatment.
 *
 * The calculated sky is a separate panel ABOVE the photo, never an overlay
 * on the uploaded photo. No AI service is involved in this layout.
 */
export type AbovePhotoFitMode =
  | 'fit' | 'center-crop' | 'top-crop' | 'bottom-crop' | 'stretch'
export const DEFAULT_SKY_PERCENT = 38

export function fitAbovePhotoLayout(
  viewportWidth: number, viewportHeight: number,
  photoWidth: number, photoHeight: number,
  skyPercent = DEFAULT_SKY_PERCENT,
): { width: number; height: number; skyHeight: number; photoHeight: number } {
  if (![viewportWidth, viewportHeight, photoWidth, photoHeight, skyPercent].every(Number.isFinite) ||
    viewportWidth <= 0 || viewportHeight <= 0 || photoWidth <= 0 || photoHeight <= 0) {
    return { width: 0, height: 0, skyHeight: 0, photoHeight: 0 }
  }

  const boundedSkyPercent = Math.max(20, Math.min(70, skyPercent))
  // Fix the outer frame shape using the photo at the default split, so moving
  // the slider changes the division instead of changing the whole frame size.
  const frameAspect = (photoWidth / photoHeight) * (1 - DEFAULT_SKY_PERCENT / 100)
  const height = Math.min(viewportHeight * .94, viewportWidth * .94 / frameAspect)
  const width = height * frameAspect
  const skyHeight = height * boundedSkyPercent / 100
  return { width, height, skyHeight, photoHeight: height - skyHeight }
}
