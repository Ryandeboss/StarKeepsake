import type { DesignSpec } from './designSpec'
import { selectSkyBlendPoints, skyCoverage } from './skyBlendMath'
import type { SkySegmentation } from './skyBlendMath'

/**
 * Experimental, opt-in browser-only sky detection.
 *
 * Version-pinned TF.js and DeepLab ADE20K scripts and their published model
 * weights are fetched only after the customer requests detection. Pixels are
 * classified locally, not sent to an AI image-inference endpoint.
 * This is an artistic blend; photo azimuth/FOV/camera orientation are unknown.
 */
const TFJS_SCRIPT = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js'
const DEEPLAB_SCRIPT = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/deeplab@0.2.2/dist/deeplab.min.js'

type DeepLabResult = {
  width: number
  height: number
  legend: Record<string, [number, number, number]>
  segmentationMap: Uint8ClampedArray
}
type DeepLabModel = {
  segment: (input: HTMLCanvasElement) => Promise<DeepLabResult>
}
type DeepLabGlobal = {
  load: (options: { base: 'ade20k'; quantizationBytes: 1 }) => Promise<DeepLabModel>
}
type MlWindow = Window & { deeplab?: DeepLabGlobal; tf?: { ready: () => Promise<void> } }
const activeScriptLoads = new Map<string, Promise<void>>()
let modelPromise: Promise<DeepLabModel> | undefined

function loadScript(src: string): Promise<void> {
  const existing = activeScriptLoads.get(src)
  if (existing) return existing
  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      activeScriptLoads.delete(src)
      reject(new Error('The optional sky-recognition model could not be loaded. Try Classic Frame instead.'))
    }
    document.head.appendChild(script)
  })
  activeScriptLoads.set(src, loading)
  return loading
}

async function loadModel(): Promise<DeepLabModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await loadScript(TFJS_SCRIPT)
      const mlWindow = window as MlWindow
      if (!mlWindow.tf) throw new Error('TensorFlow.js did not initialize.')
      await mlWindow.tf.ready()
      await loadScript(DEEPLAB_SCRIPT)
      if (!mlWindow.deeplab) throw new Error('The sky-recognition model did not initialize.')
      return mlWindow.deeplab.load({ base: 'ade20k', quantizationBytes: 1 })
    })().catch((error: unknown) => {
      modelPromise = undefined
      throw error
    })
  }
  return modelPromise
}

function loadImage(photoUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Your photo could not be opened. Try uploading it again.'))
    image.src = photoUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not prepare the blended preview.')),
      'image/png',
    )
  })
}

export type HorizonBlendResult =
  | { kind: 'success'; image: Blob; skyPercent: number; placedStars: number }
  | { kind: 'no-sky'; skyPercent: number; placedStars: 0 }

export async function generateHorizonBlend(
  photoUrl: string,
  spec: Pick<DesignSpec, 'stars' | 'regions'>,
): Promise<HorizonBlendResult> {
  if (!photoUrl || spec.stars.length === 0) {
    throw new Error('Upload a photo and calculate your real sky before using Horizon Blend.')
  }
  const image = await loadImage(photoUrl)
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('The photo appears to be empty.')
  }

  const factor = Math.min(1, 1100 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * factor))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * factor))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('The browser cannot process this photo.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const model = await loadModel()
  const result = await model.segment(canvas)
  const skyColor = result.legend.sky
  if (!skyColor) {
    return { kind: 'no-sky', skyPercent: 0, placedStars: 0 }
  }
  const mask: SkySegmentation = {
    width: result.width,
    height: result.height,
    segmentationMap: result.segmentationMap,
    skyColor,
  }
  const coverage = skyCoverage(mask)
  if (coverage < 0.025) {
    return { kind: 'no-sky', skyPercent: Math.round(coverage * 100), placedStars: 0 }
  }
  const stars = selectSkyBlendPoints(spec.stars, spec.regions.sky, mask)
  if (!stars.length) {
    return { kind: 'no-sky', skyPercent: Math.round(coverage * 100), placedStars: 0 }
  }

  // Apply an atmospheric blue tint only to pixels semantically classified
  // as sky. Keep portraits, trees and foreground opaque and untouched.
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  for (let y = 0; y < canvas.height; y++) {
    const my = Math.min(mask.height - 1, Math.floor(y / canvas.height * mask.height))
    for (let x = 0; x < canvas.width; x++) {
      const mx = Math.min(mask.width - 1, Math.floor(x / canvas.width * mask.width))
      const maskOffset = (my * mask.width + mx) * 4
      if (mask.segmentationMap[maskOffset] !== skyColor[0] ||
          mask.segmentationMap[maskOffset + 1] !== skyColor[1] ||
          mask.segmentationMap[maskOffset + 2] !== skyColor[2]) continue
      const index = (y * canvas.width + x) * 4
      data[index] = Math.round(data[index] * 0.66)
      data[index + 1] = Math.round(data[index + 1] * 0.72)
      data[index + 2] = Math.round(data[index + 2] * 0.84)
    }
  }
  context.putImageData(pixels, 0, 0)

  // Only genuine engine-projected stars are used. Their positions here are
  // ARTISTIC: missing camera orientation/FOV prevents photo-real registration.
  for (const { x, y, star } of stars) {
    const px = x * canvas.width
    const py = y * canvas.height
    const size = Math.max(1, Math.min(2.7, 2.4 - star.magnitude * 0.23))
    context.beginPath()
    context.fillStyle = '#fbe6b7'
    context.shadowColor = 'rgba(246,223,168,0.95)'
    context.shadowBlur = size * 5
    context.arc(px, py, size, 0, Math.PI * 2)
    context.fill()
  }
  context.shadowBlur = 0

  return {
    kind: 'success',
    image: await canvasToBlob(canvas),
    skyPercent: Math.round(coverage * 100),
    placedStars: stars.length,
  }
}
