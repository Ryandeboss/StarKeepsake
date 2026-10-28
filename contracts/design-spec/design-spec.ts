export const DESIGN_SPEC_VERSION = '1.0' as const

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

export type MomentSpec = {
  date: string
  time: string
  exactTimeUnknown: boolean
  location: string
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
}

export type DesignStar = MillimeterPoint & {
  magnitude: number
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
  stars: readonly DesignStar[]
}

export const DESIGN_REGIONS: DesignRegions = {
  sky: {
    xMm: 0,
    yMm: 0,
    widthMm: 279.4,
    heightMm: 355.6,
    label: 'Full physical artwork sky field',
  },
  engravingPhoto: {
    xMm: 34.7,
    yMm: 54.5,
    widthMm: 210,
    heightMm: 125,
    label: 'Engraved photo area',
  },
  text: {
    xMm: 34.7,
    yMm: 210,
    widthMm: 210,
    heightMm: 86,
    label: 'Custom text and moment metadata',
  },
}

export const DEFAULT_STARS: readonly DesignStar[] = [
  { xMm: 25.4, yMm: 39.2, magnitude: 2.1, holeSizeMm: 1.2, ledIndex: 0 },
  { xMm: 66.8, yMm: 86.1, magnitude: 1.4, holeSizeMm: 1.6, ledIndex: 1 },
  { xMm: 103.5, yMm: 30.7, magnitude: 2.8, holeSizeMm: 0.9, ledIndex: 2 },
  { xMm: 143.2, yMm: 117.6, magnitude: 1.8, holeSizeMm: 1.3, ledIndex: 3 },
  { xMm: 187.5, yMm: 55.3, magnitude: 2.4, holeSizeMm: 1.1, ledIndex: 4 },
  { xMm: 232.1, yMm: 101.8, magnitude: 1.2, holeSizeMm: 1.8, ledIndex: 5 },
  { xMm: 48.6, yMm: 236.5, magnitude: 2.6, holeSizeMm: 1, ledIndex: 6 },
  { xMm: 91.8, yMm: 315.4, magnitude: 1.7, holeSizeMm: 1.4, ledIndex: 7 },
  { xMm: 139.7, yMm: 177.8, magnitude: 1.1, holeSizeMm: 1.9, ledIndex: 8 },
  { xMm: 216.4, yMm: 274.2, magnitude: 2, holeSizeMm: 1.3, ledIndex: 9 },
]
