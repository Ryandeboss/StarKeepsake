import { useEffect, useRef, useState } from 'react'
import { generateSkyMask, skyMaskAvailability } from '../api'
import { applySkyAlpha, maskLooksUsable } from '../skyAiMask'
import { createSkylineCutout, hasTransparentSky } from '../skyCutout'
import './SkyCutoutPreview.css'

type Props = {
  file: File
  onApply: (image: Blob) => void
  onCancel: () => void
}
type Source = 'ai' | 'local' | 'original'

/**
 * No painting, clipping or scrollable zoom canvas. Both columns show the FULL
 * photo with object-fit:contain. AI calls only happen after a deliberate click.
 */
export function SkyCutoutPreview({ file, onApply, onCancel }: Props) {
  const [originalUrl] = useState(() => URL.createObjectURL(file))
  const [resultUrl, setResultUrl] = useState('')
  const [resultSource, setResultSource] = useState<Source | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [invert, setInvert] = useState(false)
  const [transparentInput, setTransparentInput] = useState(false)
  const [showCheckerboard, setShowCheckerboard] = useState(false)
  const resultBlob = useRef<Blob | null>(null)
  const maskBlob = useRef<Blob | null>(null)
  const controller = useRef<AbortController | null>(null)
  const initialButton = useRef<HTMLButtonElement>(null)
  const outputUrl = useRef<string | null>(null)

  useEffect(() => {
    initialButton.current?.focus()
    let active = true
    void skyMaskAvailability().then(value => { if (active) setAvailable(value) })
    void createImageBitmap(file).then(bitmap => {
      if (!active) { bitmap.close(); return }
      // A small scan detects if the user supplied an already-masked PNG.
      const canvas = document.createElement('canvas')
      canvas.width = Math.min(bitmap.width, 256)
      canvas.height = Math.min(bitmap.height, 256)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        setTransparentInput(hasTransparentSky(ctx.getImageData(0,0,canvas.width,canvas.height).data))
      }
      bitmap.close()
    }).catch(() => setError('Could not inspect the original image.'))
    return () => {
      active = false
      controller.current?.abort()
      URL.revokeObjectURL(originalUrl)
      if (outputUrl.current) URL.revokeObjectURL(outputUrl.current)
    }
  }, [file, originalUrl])

  function showResult(blob: Blob, source: Source) {
    if (outputUrl.current) URL.revokeObjectURL(outputUrl.current)
    const url = URL.createObjectURL(blob)
    outputUrl.current = url
    resultBlob.current = blob
    setResultUrl(url)
    setResultSource(source)
  }

  /** Request a reduced transmission copy, but composite against the original pixels. */
  async function prepareAiUpload(signal: AbortSignal): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    try {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      if (bitmap.width * bitmap.height > 60_000_000)
        throw new Error('Choose a smaller image (under 60 megapixels).')
      const size = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * size)
      canvas.height = Math.round(bitmap.height * size)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('The browser could not prepare this image.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare AI image.')),
          'image/jpeg', .9))
    } finally { bitmap.close() }
  }

  async function composeFromMask(mask: Blob, reversed: boolean): Promise<Blob> {
    const [sourceBitmap, skyBitmap] = await Promise.all([createImageBitmap(file), createImageBitmap(mask)])
    try {
      if (sourceBitmap.width * sourceBitmap.height > 25_000_000)
        throw new Error('Choose a photo under 25 megapixels for the preview.')
      const canvas = document.createElement('canvas')
      canvas.width = sourceBitmap.width
      canvas.height = sourceBitmap.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('The browser could not process this photo.')
      ctx.drawImage(sourceBitmap, 0, 0)
      const original = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = canvas.width
      maskCanvas.height = canvas.height
      const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })
      if (!maskCtx) throw new Error('The browser could not process the AI mask.')
      maskCtx.drawImage(skyBitmap, 0, 0, canvas.width, canvas.height)
      const maskPixels = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data
      if (!maskLooksUsable(maskPixels))
        throw new Error('AI did not identify a usable sky area. Your original photo is unchanged.')
      const cutout = applySkyAlpha(original.data, maskPixels, reversed)
      original.data.set(cutout)
      ctx.putImageData(original, 0, 0)
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob =>
        blob ? resolve(blob) : reject(new Error('Could not export the transparent image.')), 'image/png'))
    } finally {
      sourceBitmap.close()
      skyBitmap.close()
    }
  }

  async function removeSky() {
    if (processing || available !== true) return
    const abort = new AbortController()
    controller.current = abort
    setProcessing(true)
    setError('')
    try {
      const jpg = await prepareAiUpload(abort.signal)
      const mask = await generateSkyMask(jpg, abort.signal)
      if (abort.signal.aborted) return
      const cutout = await composeFromMask(mask, false)
      if (abort.signal.aborted) return
      maskBlob.current = mask
      setInvert(false)
      showResult(cutout, 'ai')
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'AI sky removal failed.')
    } finally {
      controller.current = null
      setProcessing(false)
    }
  }

  async function reverseMask(value: boolean) {
    if (!maskBlob.current || processing) return
    setProcessing(true)
    setError('')
    try {
      const cutout = await composeFromMask(maskBlob.current, value)
      setInvert(value)
      showResult(cutout, 'ai')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not invert this mask.')
    } finally { setProcessing(false) }
  }

  async function localRemoval() {
    if (processing) return
    setProcessing(true)
    setError('')
    try {
      // The existing deterministic white-matte remover remains an explicit
      // fallback, not the default or a claim of semantic segmentation.
      const cutout = await createSkylineCutout(file)
      maskBlob.current = null
      showResult(cutout, 'local')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Local removal failed.')
    } finally { setProcessing(false) }
  }

  function useOriginalTransparency() {
    maskBlob.current = null
    showResult(file, 'original')
  }

  return <div className="sky-ai-backdrop">
    <section role="dialog" aria-modal="true" aria-labelledby="sky-ai-title"
      className="sky-ai-dialog" onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
      }}>
      <header className="sky-ai-header">
        <div>
          <span>StarKeepsake · Skyline photo</span>
          <h2 id="sky-ai-title">Remove the sky from your photo</h2>
          <p>Keep the buildings, trees, waterfront and original colors. Preview the entire image before applying it.</p>
        </div>
        <button ref={initialButton} aria-label="Close image preview" type="button" onClick={onCancel}>✕</button>
      </header>
      <div className="sky-ai-actions">
        <button type="button" className="sky-ai-main" disabled={processing || available !== true}
          onClick={() => { void removeSky() }}>{processing ? 'Processing image…' : '✦ Remove sky with AI'}</button>
        <button type="button" onClick={() => { void localRemoval() }} disabled={processing}>Use local white-sky remover</button>
        {transparentInput && <button type="button" onClick={useOriginalTransparency} disabled={processing}>
          Use existing transparency
        </button>}
        {resultSource === 'ai' && <label><input type="checkbox" checked={invert}
          disabled={processing} onChange={event => { void reverseMask(event.target.checked) }}/>
          Invert AI mask</label>}
        <label><input type="checkbox" checked={showCheckerboard} onChange={event => setShowCheckerboard(event.target.checked)}/>
          Checkerboard background</label>
      </div>
      {available === null && <p className="sky-ai-status" role="status">Checking AI availability…</p>}
      {available === false && <p className="sky-ai-status" role="status">
        AI removal is not configured yet. A server-side Fal API key is required; the local remover
        or an already-transparent PNG can still be used.
      </p>}
      {processing && <p className="sky-ai-status" role="status">Identifying sky regions. Original foreground pixels will be preserved.</p>}
      {error && <p className="sky-ai-error" role="alert">{error}</p>}
      <div className="sky-ai-images">
        <figure>
          <figcaption>Original photo</figcaption>
          <div className="sky-ai-photo-shell sky-ai-original">
            {originalUrl && <img src={originalUrl} alt="Complete original skyline before sky removal"/>}
          </div>
        </figure>
        <figure>
          <figcaption>{resultSource ? 'Sky removed · review before applying' : 'Your transparent preview'}</figcaption>
          <div className={`sky-ai-photo-shell ${showCheckerboard ? 'sky-ai-checkers' : 'sky-ai-night'}`}>
            {resultUrl ? <img src={resultUrl} alt="Complete skyline with removed sky shown transparent"/> :
              <div className="sky-ai-placeholder">The edited photo will appear here at its full aspect ratio.</div>}
          </div>
        </figure>
      </div>
      <footer className="sky-ai-footer">
        <small>AI uses a third-party sky segmentation service only when you click the AI button.
          Your original photo isn't regenerated. This is an illustrative skyline, not a calibrated 360° view.</small>
        <div>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="sky-ai-main" disabled={!resultSource || processing}
            onClick={() => { if (resultBlob.current) onApply(resultBlob.current) }}>Apply to night sky</button>
        </div>
      </footer>
    </section>
  </div>
}
