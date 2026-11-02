/**
 * Fit a framed, vertically stacked star-sky and original photo into a viewer.
 * The photo retains its full natural aspect ratio. The separate upper sky adds
 * height; it NEVER overlays/crops the photo or requires a sky mask.
 */
export function fitAbovePhotoLayout(
  viewportWidth: number, viewportHeight: number,
  photoWidth: number, photoHeight: number,
  upperSkyFraction = 0.4,
): { width: number; height: number; skyHeight: number; photoHeight: number } {
  if (![viewportWidth, viewportHeight, photoWidth, photoHeight, upperSkyFraction].every(Number.isFinite) ||
    viewportWidth <= 0 || viewportHeight <= 0 || photoWidth <= 0 || photoHeight <= 0 ||
    upperSkyFraction <= 0) {
    return { width: 0, height: 0, skyHeight: 0, photoHeight: 0 }
  }
  const ratio = photoWidth / photoHeight
  const safeFraction = Math.max(0.15, Math.min(0.8, upperSkyFraction))
  const availableWidth = viewportWidth * .94
  const availableHeight = viewportHeight * .94
  const actualPhotoHeight = Math.min(availableHeight / (1 + safeFraction), availableWidth / ratio)
  const actualSkyHeight = actualPhotoHeight * safeFraction
  return {
    width: actualPhotoHeight * ratio,
    height: actualPhotoHeight + actualSkyHeight,
    skyHeight: actualSkyHeight,
    photoHeight: actualPhotoHeight,
  }
}
