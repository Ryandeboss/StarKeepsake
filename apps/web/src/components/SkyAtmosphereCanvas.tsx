import { useEffect, useRef } from 'react'
import { skyRgb } from '../skyPhotographicMath'

type Props = { heading: number; pitch: number; fov: number; enhanced: boolean }

/** Small 2D color buffer behind the actual Hipparcos SVG star field.
 * The camera changes trigger a redraw, but no photos or network calls occur.
 * Heading is deliberately irrelevant to altitude-derived haze; broad
 * photographic illumination is not assigned a made-up city compass bearing.
 */
export function SkyAtmosphereCanvas({ heading, pitch, fov, enhanced }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const frame = window.requestAnimationFrame(() => {
      // Limit per-frame CPU work during drag; browser interpolates smooth haze.
      const width = 400
      const height = 240
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return
      const pixels = ctx.createImageData(width,height)
      for (let row=0; row<height; row++) {
        for (let col=0; col<width; col++) {
          const rgb = skyRgb(col/width*1000,row/height*600,pitch,fov,enhanced)
          const i = (row*width+col)*4
          pixels.data[i] = rgb[0]
          pixels.data[i+1] = rgb[1]
          pixels.data[i+2] = rgb[2]
          pixels.data[i+3] = 255
        }
      }
      ctx.putImageData(pixels,0,0)
    })
    return () => window.cancelAnimationFrame(frame)
    // heading is kept in the props contract to match the observer camera;
    // sky haze depends on altitude, not a guessed compass orientation.
  }, [heading,pitch,fov,enhanced])
  return <canvas className="immersive-photo-sky" ref={ref}
    aria-hidden="true"/>
}
