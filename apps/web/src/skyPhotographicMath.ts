/**
 * Color-graded, direction-aware night-sky atmosphere for the interactive
 * educational observer. Stars are rendered separately from calculated HIP
 * coordinates. Do not add randomly positioned points of light here: that
 * would make the star field scientifically misleading.
 *
 * This is an illustrative photographic exposure, not a physically measured
 * Chicago Bortle class, atmospheric scattering, weather, or Milky Way model.
 */
const DEG = Math.PI / 180
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const gaussian = (value: number, center: number, width: number) =>
  Math.exp(-Math.pow((value-center)/width, 2))

export function altitudeForCameraPixel(
  x: number, y: number, pitchDeg: number, horizontalFovDeg: number,
  width = 1000, height = 600,
): number {
  const tangent = Math.tan(horizontalFovDeg * DEG / 2)
  // Ray geometry matches projectObserverStar's perspective, which uses
  // vertical tangent = horizontal tangent * 0.6 for its 1000:600 viewBox.
  const right = (x / width * 2 - 1) * tangent
  const up = (1 - y / height * 2) * tangent * (height/width)
  const pitch = pitchDeg * DEG
  const sinAlt = (Math.sin(pitch) + up * Math.cos(pitch)) /
    Math.sqrt(1 + right*right + up*up)
  return Math.asin(clamp(sinAlt,-1,1)) / DEG
}

export function skyRgb(
  x: number, y: number, pitchDeg: number, horizontalFovDeg: number,
  enhanced: boolean,
): [number, number, number] {
  const altitude = altitudeForCameraPixel(x,y,pitchDeg,horizontalFovDeg)
  const horizon = gaussian(altitude,2.3,14)
  const airglow = gaussian(altitude,12,32)
  const zenith = clamp(altitude / 77,0,1)
  const urbanWeight = .7 + .3 * Math.max(0,Math.cos((x/1000-.5)*Math.PI))
  const exposure = enhanced ? 1 : .58
  // Upper atmosphere is near-black charcoal, not saturated flat royal blue.
  let red = 3.5 + 4 * (1 - zenith)
  let green = 7 + 9 * (1 - zenith)
  let blue = 16 + 14 * (1 - zenith)
  red += exposure * (23*horizon*urbanWeight + 3*airglow)
  green += exposure * (12*horizon*urbanWeight + 6*airglow)
  blue += exposure * (4*horizon + 12*airglow)
  // Broad, low-contrast wisps of airglow; no fake star placements.
  const pattern = Math.sin(x*.010 + altitude*.16) * Math.sin(y*.018 - x*.007)
  const veil = exposure * pattern * airglow * 2.0
  red += veil*.65
  green += veil
  blue += veil*1.25
  // Stable tiny sensor-like dithering avoids obvious bands without noisy dots.
  const xi = Math.floor(x), yi=Math.floor(y)
  const noise = ((((xi*73856093) ^ (yi*19349663)) >>> 0) % 256) / 255 - .5
  const grain = noise * (enhanced ? 1.15 : .65)
  return [
    clamp(Math.round(red+grain),0,255),
    clamp(Math.round(green+grain),0,255),
    clamp(Math.round(blue+grain),0,255),
  ]
}

/** Apparent flux and optional long-exposure effect for a true catalogued star.
 * Star size here models photographic blooming, not the star's actual radius.
 */
export function starOptics(
  magnitude: number,
  altitudeDeg: number,
  isKnownColor: boolean,
  enhanced = true,
) {
  const flux = Math.pow(10, -.4*(magnitude - 1))
  const alt = Math.max(3, altitudeDeg) * DEG
  const airmass = 1 / (Math.sin(alt) + .09) // bounded visual approximation
  const extinction = clamp(Math.exp(-.12 * Math.max(0, airmass-1)),.28,1)
  const coreRadius = clamp(.54 + .53 * Math.sqrt(flux),.52,2.8)
  const haloRadius = clamp(3 + Math.log2(2+flux)*2.6,4,16) * (isKnownColor ? 1.1 : 1)
  return {
    coreRadius,
    haloRadius,
    coreOpacity: clamp((.58 + .30*Math.sqrt(flux)) * extinction,.18,1),
    haloOpacity: (isKnownColor ? .46 : .24) * extinction * (enhanced ? 1 : .42),
    spikes: enhanced && magnitude < .15,
  }
}
