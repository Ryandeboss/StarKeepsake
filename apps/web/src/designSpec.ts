import {
  DEFAULT_STARS,
  DESIGN_REGIONS,
  DESIGN_SPEC_VERSION,
  PHYSICAL_ARTWORK,
} from '../../../contracts/design-spec/design-spec'
import type { DesignSpec } from '../../../contracts/design-spec/design-spec'

export type {
  DesignSpec,
  MaterialStyleSpec,
  ResolvedLocation,
} from '../../../contracts/design-spec/design-spec'
export { DESIGN_SPEC_VERSION, PHYSICAL_ARTWORK } from '../../../contracts/design-spec/design-spec'

export const INITIAL_DESIGN_SPEC: DesignSpec = {
  schemaVersion: DESIGN_SPEC_VERSION,
  designId: 'design-placeholder',
  templateId: 'starkeep-11x14-v1',
  physicalArtwork: PHYSICAL_ARTWORK,
  regions: DESIGN_REGIONS,
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
    crop: { x: 0, y: 0, width: 1, height: 1 },
    positionMm: {
      xMm: DESIGN_REGIONS.engravingPhoto.xMm,
      yMm: DESIGN_REGIONS.engravingPhoto.yMm,
      widthMm: DESIGN_REGIONS.engravingPhoto.widthMm,
      heightMm: DESIGN_REGIONS.engravingPhoto.heightMm,
    },
  },
  customText: {
    value: '',
    positionMm: {
      xMm: DESIGN_REGIONS.text.xMm,
      yMm: DESIGN_REGIONS.text.yMm,
      widthMm: DESIGN_REGIONS.text.widthMm,
      heightMm: DESIGN_REGIONS.text.heightMm,
    },
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
    projection: 'azimuthal-equidistant',
    magnitudeLimit: 6,
    maxStars: 96,
    minSeparationMm: 3.5,
  },
  astronomy: null,
  stars: [...DEFAULT_STARS],
}
