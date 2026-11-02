/** Simplified azimuth/altitude sky-dome guide for the first-person viewer.
 *  It is an orientation aid, not a photographic panorama or a star map.
 */
const radians = Math.PI / 180
export const SKY_DOME_MIN_ALTITUDE = -25
export const SKY_DOME_MAX_ALTITUDE = 90

export function normalizeBearing(value: number): number {
  return ((value % 360) + 360) % 360
}

export type DomeSpan = { startDeg: number; widthDeg: number }
export type DomeWindow = {
  spans: DomeSpan[]
  topAltitude: number
  bottomAltitude: number
  centerAltitude: number
  centerBearing: number
  verticalFov: number
}

export function domeWindow(
  heading: number, pitch: number, horizontalFov: number,
  aspect = 5 / 3,
): DomeWindow {
  // Vertical FOV is derived from the same horizontal FOV and 1000x600
  // camera aspect used by projectObserverStar, not guessed independently.
  const verticalFov = 2 * Math.atan(Math.tan(horizontalFov * radians / 2) / aspect) / radians
  const half = Math.min(180, horizontalFov) / 2
  const left = normalizeBearing(heading - half)
  const total = half * 2
  const firstWidth = Math.min(total, 360 - left)
  const spans = [{ startDeg: left, widthDeg: firstWidth }]
  if (total - firstWidth > 0.00001) spans.push({ startDeg: 0, widthDeg: total - firstWidth })

  return {
    spans,
    topAltitude: Math.min(SKY_DOME_MAX_ALTITUDE, pitch + verticalFov / 2),
    bottomAltitude: Math.max(SKY_DOME_MIN_ALTITUDE, pitch - verticalFov / 2),
    centerAltitude: Math.min(SKY_DOME_MAX_ALTITUDE, Math.max(SKY_DOME_MIN_ALTITUDE, pitch)),
    centerBearing: normalizeBearing(heading),
    verticalFov,
  }
}

export function domeAltitudeY(altitude: number, top = 30, height = 90): number {
  const clipped = Math.max(SKY_DOME_MIN_ALTITUDE, Math.min(SKY_DOME_MAX_ALTITUDE, altitude))
  return top + ((SKY_DOME_MAX_ALTITUDE - clipped) /
    (SKY_DOME_MAX_ALTITUDE - SKY_DOME_MIN_ALTITUDE)) * height
}
