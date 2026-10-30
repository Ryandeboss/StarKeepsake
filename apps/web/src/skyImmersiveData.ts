import type { DesignStar } from '../../../contracts/design-spec/design-spec'

// The bright-star palette is curated for identified objects. Without spectral
// data in the API we cannot honestly assign a physical color to every HIP star.
// Sizes below represent *apparent* brightness, never the physical stellar radius.
export const NAMED_STAR_COLORS: Readonly<Record<number, { color: string; category: string }>> = {
  7588: { color: '#b5d6ff', category: 'blue-white' },
  21421: { color: '#ffc48a', category: 'orange giant' },
  24436: { color: '#a9ceff', category: 'blue-white supergiant' },
  24608: { color: '#ffefd1', category: 'yellow-white system' },
  27989: { color: '#ffa18c', category: 'red supergiant' },
  30438: { color: '#f7f4e7', category: 'white' },
  32349: { color: '#f4f8ff', category: 'white' },
  37279: { color: '#fff3e2', category: 'yellow-white' },
  49669: { color: '#b9d8ff', category: 'blue-white' },
  65474: { color: '#a5caff', category: 'blue-white' },
  69673: { color: '#ffcb95', category: 'orange giant' },
  91262: { color: '#e5edff', category: 'white-blue' },
  97649: { color: '#f8f6f4', category: 'white' },
  102098: { color: '#b4d8ff', category: 'blue-white supergiant' },
  3179: { color: '#ffca9b', category: 'orange giant' },
  54061: { color: '#ffcf9a', category: 'orange giant' },
  25336: { color: '#aed1ff', category: 'blue-white' },
  25930: { color: '#b8d7ff', category: 'blue-white' },
  26311: { color: '#b1d2ff', category: 'blue-white supergiant' },
  26727: { color: '#b8d7ff', category: 'blue-white' },
  27366: { color: '#aed1ff', category: 'blue-white supergiant' },
  53910: { color: '#eaf0ff', category: 'white' },
  58001: { color: '#eff3ff', category: 'white' },
  59774: { color: '#f6f5ff', category: 'white' },
  62956: { color: '#f6f5ff', category: 'white' },
  65378: { color: '#f6f5ff', category: 'white' },
  67301: { color: '#b2d3ff', category: 'blue-white' },
  746: { color: '#ffedcb', category: 'yellow-white' },
  4427: { color: '#b4d6ff', category: 'blue-white' },
  6686: { color: '#eff3ff', category: 'white' },
  8886: { color: '#bbd9ff', category: 'blue-white' },
}

export function starAppearance(star: Pick<DesignStar, 'hipparcosId' | 'magnitude'>): {
  color: string
  category: string
  radius: number
  named: boolean
} {
  const documented = NAMED_STAR_COLORS[star.hipparcosId]
  const radius = Math.min(7.5, Math.max(1.4, 5.7 - star.magnitude * 0.88))
  return {
    color: documented?.color ?? '#f3f1eb',
    category: documented?.category ?? 'color not catalogued here',
    radius: documented ? radius * 1.1 : radius,
    named: Boolean(documented),
  }
}

export type Pattern = {
  id: string
  title: string
  kind: 'constellation' | 'asterism'
  subtitle: string
  meaning: string
  guide: string
  stars: readonly { hip: number; x: number; y: number }[]
  segments: readonly (readonly [number, number])[]
}

export const SKY_PATTERNS: readonly Pattern[] = [
  {
    id: 'orion', title: 'Orion', kind: 'constellation', subtitle: 'The Hunter',
    meaning: 'In one Greek tradition Orion is a great hunter placed among the stars. Its familiar shoulders, three-star belt and feet make it a useful first constellation to learn.',
    guide: 'Find three nearly straight stars (the Belt); trace upward to reddish Betelgeuse and downward toward bright blue-white Rigel.',
    stars: [
      { hip: 27989, x: 18, y: 18 }, { hip: 25336, x: 78, y: 20 },
      { hip: 25930, x: 28, y: 49 }, { hip: 26311, x: 49, y: 50 },
      { hip: 26727, x: 70, y: 51 }, { hip: 27366, x: 20, y: 85 },
      { hip: 24436, x: 81, y: 86 },
    ],
    segments: [
      [27989,25336], [27989,25930], [25336,26727],
      [25930,26311], [26311,26727], [25930,27366], [26727,24436],
    ],
  },
  {
    id: 'dipper', title: 'Big Dipper', kind: 'asterism', subtitle: 'Inside Ursa Major',
    meaning: 'The seven-star ladle belongs to the larger constellation Ursa Major (the Great Bear). The two outer bowl stars are often used to find Polaris, the North Star.',
    guide: 'Locate four stars forming a bowl, then follow the curved line of three stars forming its handle.',
    stars: [
      { hip: 54061, x: 14, y: 23 }, { hip: 53910, x: 14, y: 72 },
      { hip: 58001, x: 47, y: 74 }, { hip: 59774, x: 50, y: 33 },
      { hip: 62956, x: 66, y: 30 }, { hip: 65378, x: 79, y: 18 },
      { hip: 67301, x: 94, y: 10 },
    ],
    segments: [
      [54061,53910], [53910,58001], [58001,59774], [59774,54061],
      [59774,62956], [62956,65378], [65378,67301],
    ],
  },
  {
    id: 'cassiopeia', title: 'Cassiopeia', kind: 'constellation', subtitle: 'The Queen',
    meaning: 'Cassiopeia is traditionally represented as a queen from Greek mythology. Its five brightest stars make a recognizable W or M depending on where it is in the sky.',
    guide: 'Look for five stars zigzagging in a W shape. As Earth turns, the W may appear tipped or inverted.',
    stars: [
      { hip: 746, x: 8, y: 70 }, { hip: 3179, x: 30, y: 22 },
      { hip: 4427, x: 50, y: 67 }, { hip: 6686, x: 71, y: 22 },
      { hip: 8886, x: 93, y: 70 },
    ],
    segments: [[746,3179],[3179,4427],[4427,6686],[6686,8886]],
  },
  {
    id: 'triangle', title: 'Summer Triangle', kind: 'asterism', subtitle: 'Vega · Deneb · Altair',
    meaning: 'The Summer Triangle is not an official constellation. Its three stars belong to Lyra, Cygnus and Aquila and make a broad, easy-to-spot pattern in northern summer skies.',
    guide: 'Find bright Vega first, then Deneb and Altair to complete a very large triangle.',
    stars: [
      { hip: 91262, x: 23, y: 18 }, { hip: 102098, x: 85, y: 26 },
      { hip: 97649, x: 56, y: 89 },
    ],
    segments: [[91262,102098],[102098,97649],[97649,91262]],
  },
]

// Gnomonic/pinhole view of a real observer's azimuth and altitude.
// Forward is headingDeg (clockwise from north) at pitchDeg above horizon.
export function projectObserverStar(
  azimuthDeg: number, altitudeDeg: number,
  headingDeg: number, pitchDeg: number,
  horizontalFovDeg = 105,
): { x: number; y: number; inFront: boolean } {
  const radians = Math.PI / 180
  const delta = (azimuthDeg - headingDeg) * radians
  const altitude = altitudeDeg * radians
  const pitch = pitchDeg * radians
  const east = Math.cos(altitude) * Math.sin(delta)
  const up = Math.sin(altitude) * Math.cos(pitch) - Math.cos(altitude) * Math.cos(delta) * Math.sin(pitch)
  const forward = Math.sin(altitude) * Math.sin(pitch) + Math.cos(altitude) * Math.cos(delta) * Math.cos(pitch)
  const halfTan = Math.tan(horizontalFovDeg * radians / 2)
  const x = 500 + (east / (forward * halfTan)) * 500
  const y = 300 - (up / (forward * halfTan * 0.6)) * 300
  return { x, y, inFront: forward > 0.01 && x >= -12 && x <= 1012 && y >= -12 && y <= 612 }
}

export function suggestedObserverHeading(stars: readonly DesignStar[]): number {
  const highlighted = stars
    .filter(star => NAMED_STAR_COLORS[star.hipparcosId])
    .sort((a, b) => a.magnitude - b.magnitude)[0]
  return highlighted?.azimuthDeg ?? 180
}
