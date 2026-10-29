import {
  DEFAULT_STARS,
  getFrameLayout,
  DESIGN_SPEC_VERSION,
} from '../../../contracts/design-spec/design-spec'
import type { DesignSpec, MillimeterRect, DesignRegion } from '../../../contracts/design-spec/design-spec'

export function toRect({ xMm, yMm, widthMm, heightMm }: DesignRegion): MillimeterRect {
  return { xMm, yMm, widthMm, heightMm }
}

export type {
  DesignSpec,
  MaterialStyleSpec,
  FramePresetId,
  PhotoCrop,
  ResolvedLocation,
} from '../../../contracts/design-spec/design-spec'
export { DESIGN_SPEC_VERSION, PHYSICAL_ARTWORK, FRAME_PRESETS, getFrameLayout } from '../../../contracts/design-spec/design-spec'

export const INITIAL_DESIGN_SPEC: DesignSpec = {
  schemaVersion: DESIGN_SPEC_VERSION,
  designId: 'design-placeholder',
  templateId: 'starkeep-sky-photo-v3',
  framePresetId: '11x14',
  photoAspectRatio: null,
  layoutMode: 'classic',
  physicalArtwork: getFrameLayout('11x14').physicalArtwork,
  regions: getFrameLayout('11x14').regions,
  moment: {
    date: '',
    time: null,
    exactTimeUnknown: false,
    location: null,
    localDateTime: null,
    utcDateTime: null,
  },
  photo: {
    assetId: 'local-photo-placeholder',
    fitMode: 'contain',
    crop: { x: 0, y: 0, width: 1, height: 1 },
    positionMm: toRect(getFrameLayout('11x14').regions.engravingPhoto),
  },
  customText: {
    value: '',
    positionMm: toRect(getFrameLayout('11x14').regions.text),
    align: 'center',
  },
  materialStyle: {
    material: 'midnight',
    style: 'Midnight frame',
  },
  skySettings: {
    background: 'deep-space',
    brightness: 1,
    showConstellation: true,
    projection: 'altaz-equirectangular',
    magnitudeLimit: 6,
    maxStars: 96,
    minSeparationMm: 3.5,
  },
  astronomy: null,
  stars: [...DEFAULT_STARS],
}
