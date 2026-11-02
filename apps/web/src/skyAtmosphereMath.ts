/**
 * Sky brightness is evaluated from the observer camera ray's *altitude*,
 * not from a gradient fixed to the screen or a flat Chicago photo.
 * Thus aiming above the horizon naturally removes the city's light dome.
 *
 * The night atmosphere is illustrative; it is not a historical light
 * pollution, cloud, extinction, or weather simulation.
 */
const DEG = Math.PI / 180
export const SKY_HEIGHT = 600

export function altitudeAtSkyRow(y: number, pitchDeg: number, horizontalFovDeg: number): number {
  const up = (1 - y / 300) * Math.tan(horizontalFovDeg * DEG / 2) * .6
  return pitchDeg + Math.atan(up) / DEG
}

export function atmosphericLight(altitudeDeg: number): { haze: number; amber: number } {
  if (altitudeDeg > 70 || altitudeDeg < -28) return { haze: 0, amber: 0 }
  const gaussian = (center: number, width: number) =>
    Math.exp(-Math.pow((altitudeDeg - center) / width, 2))
  return {
    haze: .28 * gaussian(5, 19),
    amber: .43 * gaussian(1.5, 9.5),
  }
}

export function atmosphereRows(pitchDeg: number, horizontalFovDeg: number, step=8) {
  const rows = []
  for (let y=0; y<SKY_HEIGHT; y+=step) {
    const altitude = altitudeAtSkyRow(y + step/2, pitchDeg, horizontalFovDeg)
    rows.push({ y, height: Math.min(step, SKY_HEIGHT-y), altitude, ...atmosphericLight(altitude) })
  }
  return rows
}

/** One limited front-facing still cannot represent a 360° panorama.
 *  Moving the *upright* foreground with horizon pitch is a 2D camera pan
 *  approximation. 0 bottom shift is calibrated at the default 15° pitch.
 */
export function photoHorizonBottomPercent(pitchDeg: number, horizontalFovDeg: number): number {
  const horizon = projectHorizonScreenY(pitchDeg, horizontalFovDeg)
  const defaultHorizon = projectHorizonScreenY(15, horizontalFovDeg)
  return (defaultHorizon - horizon) / SKY_HEIGHT * 100
}

export function projectHorizonScreenY(pitchDeg: number, horizontalFovDeg: number): number {
  const p = pitchDeg * DEG
  const scale = Math.tan(horizontalFovDeg * DEG / 2) * .6
  return 300 + Math.tan(p) * 300 / scale
}
