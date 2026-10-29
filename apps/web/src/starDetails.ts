import type { DesignStar } from './designSpec'

// Only identifiers checked against named-star catalog references.
// Do not infer a star's name or constellation from its coordinates.
export const NAMED_HIPPARCOS_STARS: Readonly<Record<number, string>> = {
  7588: 'Achernar',
  21421: 'Aldebaran',
  24436: 'Rigel',
  24608: 'Capella',
  27989: 'Betelgeuse',
  30438: 'Canopus',
  32349: 'Sirius',
  37279: 'Procyon',
  49669: 'Regulus',
  65474: 'Spica',
  69673: 'Arcturus',
  91262: 'Vega',
  97649: 'Altair',
}

export function starDisplayName(star: DesignStar): string {
  return NAMED_HIPPARCOS_STARS[star.hipparcosId] ?? `Hipparcos ${star.hipparcosId}`
}

export function starDescription(star: DesignStar): string {
  return `${starDisplayName(star)}, HIP ${star.hipparcosId}, apparent magnitude ${star.magnitude.toFixed(2)}, altitude ${star.altitudeDeg.toFixed(1)}°, azimuth ${star.azimuthDeg.toFixed(1)}°`
}
