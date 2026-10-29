export const DESIGN_SPEC_VERSION = '1.2' as const

export const PHYSICAL_ARTWORK = {
  widthMm: 279.4,
  heightMm: 355.6,
  units: 'mm',
  origin: 'top-left',
} as const

export type MillimeterPoint = {
  xMm: number
  yMm: number
}

export type MillimeterRect = MillimeterPoint & {
  widthMm: number
  heightMm: number
}

export type DesignRegion = MillimeterRect & {
  label: string
}

export type DesignRegions = {
  sky: DesignRegion
  engravingPhoto: DesignRegion
  text: DesignRegion
}

export type ResolvedLocation = {
  query: string
  displayName: string
  formattedAddress: string
  latitude: number
  longitude: number
  timeZoneId: string
  confidence: 'High' | 'Medium' | 'Low' | 'Unknown'
}

export type MomentSpec = {
  date: string
  time: string | null
  exactTimeUnknown: boolean
  location: ResolvedLocation | null
  localDateTime: string | null
  utcDateTime: string | null
}

export type PhotoCrop = {
  x: number
  y: number
  width: number
  height: number
}

export type PhotoSpec = {
  assetId: string
  crop: PhotoCrop
  positionMm: MillimeterRect
}

export type CustomTextSpec = {
  value: string
  positionMm: MillimeterRect
  align: 'left' | 'center' | 'right'
}

export type MaterialStyleSpec = {
  material: 'midnight' | 'walnut' | 'brass'
  style: 'Midnight frame' | 'Warm walnut' | 'Brushed brass'
}

export type SkySettings = {
  background: 'deep-space'
  brightness: number
  showConstellation: boolean
  projection: 'azimuthal-equidistant'
  magnitudeLimit: number
  maxStars: number
  minSeparationMm: number
}

export type AstronomyCalculation = {
  catalog: 'hipparcos'
  ephemeris: 'de440s'
  projection: 'azimuthal-equidistant'
  orientation: 'north-up-east-right'
  calculationUtcDateTime: string
  timeBasis: 'exact' | 'date-only-local-midnight'
  magnitudeLimit: number
  maxStars: number
  minSeparationMm: number
  visibleCatalogStars: number
  projectedCandidates: number
  selectedStars: number
}

export type DesignStar = MillimeterPoint & {
  hipparcosId: number
  magnitude: number
  altitudeDeg: number
  azimuthDeg: number
  holeSizeMm: number
  ledIndex: number
}

export type DesignSpec = {
  schemaVersion: typeof DESIGN_SPEC_VERSION
  designId: string
  templateId: string
  physicalArtwork: typeof PHYSICAL_ARTWORK
  regions: DesignRegions
  moment: MomentSpec
  photo: PhotoSpec
  customText: CustomTextSpec
  materialStyle: MaterialStyleSpec
  skySettings: SkySettings
  astronomy: AstronomyCalculation | null
  stars: readonly DesignStar[]
}

export const DESIGN_REGIONS: DesignRegions = {
  // The sky occupies its own upper panel. Physical star points are projected
  // inside this rectangle by the astronomy engine, not shifted by the browser.
  sky: {
    xMm: 0,
    yMm: 0,
    widthMm: 279.4,
    heightMm: 166,
    label: 'Astronomically projected sky above the photograph',
  },
  engravingPhoto: {
    xMm: 34.7,
    yMm: 174,
    widthMm: 210,
    heightMm: 125,
    label: 'Engraved photo below sky',
  },
  text: {
    xMm: 34.7,
    yMm: 305,
    widthMm: 210,
    heightMm: 44,
    label: 'Names, date, and location below photograph',
  },
}

export const DEFAULT_STARS: readonly DesignStar[] = []
