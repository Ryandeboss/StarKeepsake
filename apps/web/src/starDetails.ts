import type { DesignStar } from '../../../contracts/design-spec/design-spec'

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


/** Curated facts only for previously verified common-name HIP identifiers.
 *  Unnamed catalogue stars are not assigned invented identities or distances.
 */
export const NAMED_STAR_CONTEXT: Readonly<Record<number, { constellation: string; summary: string }>> = {
  7588: { constellation: 'Eridanus', summary: 'Achernar is a luminous blue-white star in the southern sky.' },
  21421: { constellation: 'Taurus', summary: 'Aldebaran is the orange-hued eye of Taurus, the Bull.' },
  24436: { constellation: 'Orion', summary: 'Rigel is a luminous blue supergiant associated with Orion.' },
  24608: { constellation: 'Auriga', summary: 'Capella is a bright multiple-star system in Auriga.' },
  27989: { constellation: 'Orion', summary: 'Betelgeuse is a red supergiant in the constellation Orion.' },
  30438: { constellation: 'Carina', summary: 'Canopus is one of the brightest stars in the night sky.' },
  32349: { constellation: 'Canis Major', summary: 'Sirius is the brightest star in Earth’s night sky.' },
  37279: { constellation: 'Canis Minor', summary: 'Procyon is a bright star in Canis Minor.' },
  49669: { constellation: 'Leo', summary: 'Regulus is the bright star near the heart of Leo.' },
  65474: { constellation: 'Virgo', summary: 'Spica is the bright blue-white star of Virgo.' },
  69673: { constellation: 'Boötes', summary: 'Arcturus is a luminous orange giant in Boötes.' },
  91262: { constellation: 'Lyra', summary: 'Vega is a bright star in Lyra and a corner of the Summer Triangle.' },
  97649: { constellation: 'Aquila', summary: 'Altair is a bright star in Aquila and a corner of the Summer Triangle.' },
}

export function starCatalogUrl(star: DesignStar): string {
  // Strasbourg CDS SIMBAD resolves the exact catalog identifier. No client
  // identification guesses and no extra network request during hovering.
  return `https://simbad.u-strasbg.fr/simbad/sim-id?Ident=HIP+${star.hipparcosId}`
}

export function starCompassDirection(azimuthDeg: number): string {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
  return directions[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8]
}

export function getStarContext(star: DesignStar): { constellation: string | null; summary: string } {
  const match = NAMED_STAR_CONTEXT[star.hipparcosId]
  if (match) return match
  return {
    constellation: null,
    summary: 'This is a real entry in the Hipparcos star catalogue. It does not have a verified common name in our curated list; its HIP number lets you research the object directly.',
  }
}
