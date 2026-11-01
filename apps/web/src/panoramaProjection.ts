// An uncalibrated AI panorama has no trustworthy compass heading. These
// helpers expose the two manual adjustments instead of inventing true north.
export function panoramaUvForDirection(
  azimuthDeg: number,
  altitudeDeg: number,
  imageCenterBearingDeg: number,
  horizonShift = 0,
) {
  const u = (((azimuthDeg - imageCenterBearingDeg) / 360 + .5) % 1 + 1) % 1
  const v = .5 - altitudeDeg / 180 + horizonShift
  return { u, v }
}

// Inverse of the sky observer's perspective, for GPU camera ray generation.
// Field of view matches the existing 1000x600 star SVG (aspect ratio 5:3).
export function observerDirectionAtPixel(
  x: number, y: number, headingDeg: number, pitchDeg: number, fovDeg: number,
) {
  const radians = Math.PI / 180
  const tangent = Math.tan(fovDeg * radians / 2)
  const right = (x / 500 - 1) * tangent
  const up = (1 - y / 300) * tangent * .6
  const pitch = pitchDeg * radians
  const forward = Math.cos(pitch) - up * Math.sin(pitch)
  const vertical = Math.sin(pitch) + up * Math.cos(pitch)
  const azimuthDeg = ((headingDeg + Math.atan2(right, forward) / radians) % 360 + 360) % 360
  const altitudeDeg = Math.atan2(vertical, Math.hypot(right, forward)) / radians
  return { azimuthDeg, altitudeDeg }
}
