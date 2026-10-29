export const DESIGN_SPEC_VERSION = '1.5' as const

export type FramePresetId = 'auto' | '8x10' | '11x14' | '16x20'
export type FramePreset = { id: FramePresetId; label: string; widthMm: number; heightMm: number }
export const FRAME_PRESETS: readonly FramePreset[] = [
  { id: '8x10', label: '8 × 10 in', widthMm: 203.2, heightMm: 254 },
  { id: '11x14', label: '11 × 14 in', widthMm: 279.4, heightMm: 355.6 },
  { id: '16x20', label: '16 × 20 in', widthMm: 406.4, heightMm: 508 },
] as const

export type PhysicalArtwork = {
  widthMm: number
  heightMm: number
  units: 'mm'
  origin: 'top-left'
}
export type MillimeterPoint = { xMm: number; yMm: number }
export type MillimeterRect = MillimeterPoint & { widthMm: number; heightMm: number }
export type DesignRegion = MillimeterRect & { label: string }
export type DesignRegions = { sky: DesignRegion; engravingPhoto: DesignRegion; text: DesignRegion }

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

// Coordinates are normalized to the EXIF-oriented source image, not the artboard.
// In contain mode, crop stays full-size and any unused photo panel is padded.
export type PhotoCrop = { x: number; y: number; width: number; height: number }
export type PhotoSpec = {
  assetId: string
  fitMode: 'contain' | 'cover'
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
  projection: 'altaz-equirectangular'
  magnitudeLimit: number
  maxStars: number
  minSeparationMm: number
}
export type AstronomyCalculation = {
  catalog: 'hipparcos'
  ephemeris: 'de440s'
  projection: 'altaz-equirectangular'
  orientation: 'north-center-east-right'
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
  framePresetId: FramePresetId
  photoAspectRatio: number | null
  layoutMode: 'classic' | 'horizon-blend'
  physicalArtwork: PhysicalArtwork
  regions: DesignRegions
  moment: MomentSpec
  photo: PhotoSpec
  customText: CustomTextSpec
  materialStyle: MaterialStyleSpec
  skySettings: SkySettings
  astronomy: AstronomyCalculation | null
  stars: readonly DesignStar[]
}

type Geometry = { widthMm: number; heightMm: number; marginMm: number }
const GEOMETRY: Record<FramePresetId, Geometry> = {
  '8x10': { widthMm: 203.2, heightMm: 254, marginMm: 5 },
  '11x14': { widthMm: 279.4, heightMm: 355.6, marginMm: 6 },
  '16x20': { widthMm: 406.4, heightMm: 508, marginMm: 8 },
  auto: { widthMm: 279.4, heightMm: 355.6, marginMm: 6 },
}
const mm = (value: number) => Number(value.toFixed(3))
export function getFrameLayout(id: FramePresetId, photoAspectRatio: number | null = null): {
  physicalArtwork: PhysicalArtwork
  regions: DesignRegions
} {
  if (id === 'auto' && photoAspectRatio && Number.isFinite(photoAspectRatio)) {
    const ratio = Math.min(3, Math.max(0.35, photoAspectRatio))
    const margin = 6
    const innerWidth = 279.4 - 2 * margin
    const photoHeight = innerWidth / ratio
    const skyHeight = Math.min(180, Math.max(76, photoHeight * 0.56))
    const textHeight = Math.min(45, Math.max(27, photoHeight * 0.18))
    const naturalHeight = margin * 2 + skyHeight + photoHeight + textHeight + 16
    const scale = Math.min(1, 508 / naturalHeight)
    const w = mm(279.4 * scale)
    const h = mm(naturalHeight * scale)
    const m = mm(margin * scale)
    const xWidth = mm(innerWidth * scale)
    const yPhoto = mm((margin + skyHeight + 8) * scale)
    const yText = mm((margin + skyHeight + 8 + photoHeight + 8) * scale)
    return {
      physicalArtwork: { widthMm: w, heightMm: h, units: 'mm', origin: 'top-left' },
      regions: {
        sky: { xMm: m, yMm: m, widthMm: xWidth, heightMm: mm(skyHeight * scale),
          label: 'Real sky above the photograph' },
        engravingPhoto: { xMm: m, yMm: yPhoto, widthMm: xWidth, heightMm: mm(photoHeight * scale),
          label: 'Full-width photo fitted to source aspect ratio' },
        text: { xMm: m, yMm: yText, widthMm: xWidth, heightMm: mm(textHeight * scale),
          label: 'Names, date, and place' },
      },
    }
  }
  const { widthMm, heightMm, marginMm } = GEOMETRY[id]
  const innerWidth = mm(widthMm - 2 * marginMm)
  return {
    physicalArtwork: { widthMm, heightMm, units: 'mm', origin: 'top-left' },
    regions: {
      sky: {
        xMm: marginMm, yMm: marginMm,
        widthMm: innerWidth, heightMm: mm(heightMm * 0.47 - marginMm),
        label: 'Actual sky from zenith to horizon',
      },
      engravingPhoto: {
        xMm: marginMm, yMm: mm(heightMm * 0.48),
        widthMm: innerWidth, heightMm: mm(heightMm * 0.4),
        label: 'Full-width engraved photograph',
      },
      text: {
        xMm: marginMm, yMm: mm(heightMm * 0.885),
        widthMm: innerWidth, heightMm: mm(heightMm * 0.115 - marginMm),
        label: 'Names, date, and place',
      },
    },
  }
}
export const PHYSICAL_ARTWORK = getFrameLayout('11x14').physicalArtwork
export const DESIGN_REGIONS = getFrameLayout('11x14').regions
export const DEFAULT_STARS: readonly DesignStar[] = []
