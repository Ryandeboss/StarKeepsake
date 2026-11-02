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
  const [edgeCleanup, setEdgeCleanup] = useState(2)
  const [reduceHalo, setReduceHalo] = useState(true)
  const [refining, setRefining] = useState(false)
  const [transparentInput, setTransparentInput] = useState(false)
  const [showCheckerboard, setShowCheckerboard] = useState(false)
  const resultBlob = useRef<Blob | null>(null)
  const maskBlob = useRef<Blob | null>(null)
  const controller = useRef<AbortController | null>(null)
  const initialButton = useRef<HTMLButtonElement>(null)
  const outputUrl = useRef<string | null>(null)
  const refineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refineVersion = useRef(0)
  const busy = processing || refining

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
      refineVersion.current += 1
      if (refineTimer.current) clearTimeout(refineTimer.current)
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

  async function composeFromMask(
    mask: Blob, reversed: boolean, cleanup: number, decontaminate: boolean,
  ): Promise<Blob> {
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
      const cutout = applySkyAlpha(original.data, maskPixels, reversed, {
        width: canvas.width, height: canvas.height,
        cleanupPx: cleanup, decontaminate,
      })
      original.data.set(cutout)
      ctx.putImageData(original, 0, 0)
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob =>
        blob ? resolve(blob) : reject(new Error('Could not export the transparent image.')), 'image/png'))
    } finally {
      sourceBitmap.close()
      skyBitmap.close()
    }
  }

  // Slider adjustments reuse the last Fal mask, never call Fal again.
  // Debouncing avoids repeatedly allocating full-resolution canvases.
  function scheduleRefinement(nextInvert: boolean, cleanup: number, decontaminate: boolean) {
    setInvert(nextInvert)
    setEdgeCleanup(cleanup)
    setReduceHalo(decontaminate)
    const mask = maskBlob.current
    if (!mask) return
    const version = ++refineVersion.current
    if (refineTimer.current) clearTimeout(refineTimer.current)
    setRefining(true)
    refineTimer.current = setTimeout(() => {
      refineTimer.current = null
      void (async () => {
        try {
          const cutout = await composeFromMask(mask, nextInvert, cleanup, decontaminate)
          if (version !== refineVersion.current) return
          showResult(cutout, 'ai')
          setError('')
        } catch (cause) {
          if (version === refineVersion.current) {
            setError(cause instanceof Error ? cause.message : 'Could not refine the AI mask.')
          }
        } finally {
          if (version === refineVersion.current) setRefining(false)
        }
      })()
    }, 180)
  }

  async function removeSky() {
    if (busy || available !== true) return
    const abort = new AbortController()
    controller.current = abort
    setProcessing(true)
    setError('')
    try {
      const jpg = await prepareAiUpload(abort.signal)
      const mask = await generateSkyMask(jpg, abort.signal)
      if (abort.signal.aborted) return
      const cutout = await composeFromMask(mask, false, edgeCleanup, reduceHalo)
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


  async function localRemoval() {
    if (busy) return
    refineVersion.current += 1
    if (refineTimer.current) clearTimeout(refineTimer.current)
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
    refineVersion.current += 1
    if (refineTimer.current) clearTimeout(refineTimer.current)
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
        <button type="button" className="sky-ai-main" disabled={busy || available !== true}
          onClick={() => { void removeSky() }}>{processing ? 'Processing image…' : '✦ Remove sky with AI'}</button>
        <button type="button" onClick={() => { void localRemoval() }} disabled={busy}>Use local white-sky remover</button>
        {transparentInput && <button type="button" onClick={useOriginalTransparency} disabled={busy}>
          Use existing transparency
        </button>}
        {resultSource === 'ai' && <label><input type="checkbox" checked={invert}
          disabled={processing} onChange={event =>
            scheduleRefinement(event.target.checked, edgeCleanup, reduceHalo)}/>
          Invert AI mask</label>}
        <label><input type="checkbox" checked={showCheckerboard} onChange={event => setShowCheckerboard(event.target.checked)}/>
          Checkerboard background</label>
      </div>
      {resultSource === 'ai' && <div className="sky-ai-refinement">
        <div className="sky-ai-refinement-header">
          <strong>Refine the edges</strong>
          <span>Free adjustments · no additional AI request</span>
        </div>
        <div className="sky-ai-refinement-controls">
          <label htmlFor="sky-ai-edge-cleanup">Edge cleanup: <strong>{edgeCleanup} px</strong></label>
          <input id="sky-ai-edge-cleanup" type="range" min="0" max="8" step="1"
            value={edgeCleanup} disabled={processing}
            onChange={event => scheduleRefinement(invert, Number(event.target.value), reduceHalo)}/>
          <label className="sky-ai-fringe-toggle">
            <input type="checkbox" checked={reduceHalo} disabled={processing}
              onChange={event => scheduleRefinement(invert, edgeCleanup, event.target.checked)}/>
            Remove sky-colored edge glow
          </label>
          <button type="button" className="sky-ai-reset" disabled={processing}
            onClick={() => scheduleRefinement(invert, 0, false)}>Show raw AI mask</button>
        </div>
        <p>Start at 2 px. Increase only if a sky-colored border remains around buildings or trees.
          Lower the value if fine branches disappear. Use “Show raw AI mask” to compare without edge edits.</p>
      </div>}
      {available === null && <p className="sky-ai-status" role="status">Checking AI availability…</p>}
      {available === false && <p className="sky-ai-status" role="status">
        AI removal is not configured yet. A server-side Fal API key is required; the local remover
        or an already-transparent PNG can still be used.
      </p>}
      {processing && <p className="sky-ai-status" role="status">Identifying sky regions. Original foreground pixels will be preserved.</p>}
      {refining && <p className="sky-ai-status" role="status">Refining edge pixels locally. No new AI charge.</p>}
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
          <button type="button" className="sky-ai-main" disabled={!resultSource || busy}
            onClick={() => { if (resultBlob.current) onApply(resultBlob.current) }}>Apply to night sky</button>
        </div>
      </footer>
    </section>
  </div>
}
