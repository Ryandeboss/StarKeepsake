export type FrameStyle = 'Midnight frame' | 'Warm walnut' | 'Brushed brass'

export type ConfiguratorState = {
  photoFile: File | null
  photoPreview: string
  date: string
  time: string
  exactTimeUnknown: boolean
  location: string
  names: string
  frameStyle: FrameStyle
}
