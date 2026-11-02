import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { generateSkyMask, skyMaskAvailability } from '../api'
import { applySkyAlpha, maskLooksUsable } from '../skyAiMask'
import { recoverMissedSkyMask, type MissedSkyStrength } from '../skyMissedSkyRecovery'
import { removeSkySpots, type SkySpot } from '../skySpotCleanup'
import { removeSkySweeps, type SkySweepRectangle } from '../skySweepCleanup'
import { createSkylineCutout, hasTransparentSky } from '../skyCutout'
import './SkyCutoutPreview.css'

type Props = {
  file: File
  onApply: (image: Blob) => void
  onCancel: () => void
}
type Source = 'ai' | 'local' | 'original'
type TouchMode = 'off' | 'spot' | 'sweep'
type TouchUpEdit = { kind: 'spot'; point: SkySpot } | { kind: 'sweep'; rectangle: SkySweepRectangle }
type DragState = { pointerId: number; start: SkySpot }
type DragBox = { left: number; top: number; width: number; height: number }

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
  const [skyRecovery, setSkyRecovery] = useState<MissedSkyStrength>(2)
  const [touchMode, setTouchMode] = useState<TouchMode>('off')
  const [touchEdits, setTouchEdits] = useState<TouchUpEdit[]>([])
  const [dragBox, setDragBox] = useState<DragBox | null>(null)
  const [reduceHalo, setReduceHalo] = useState(true)
  const [refining, setRefining] = useState(false)
  const [transparentInput, setTransparentInput] = useState(false)
  const [showCheckerboard, setShowCheckerboard] = useState(false)
  const resultBlob = useRef<Blob | null>(null)
  const maskBlob = useRef<Blob | null>(null)
  const previewImage = useRef<HTMLImageElement | null>(null)
  const dragState = useRef<DragState | null>(null)
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
      dragState.current = null
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
    recovery: MissedSkyStrength, edits: readonly TouchUpEdit[],
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
      // Recover sky only in the original bright image before running the
      // existing narrow edge and RGB fringe cleanup. No additional AI call.
      const recoveredMask = recoverMissedSkyMask(original.data, maskPixels, reversed, {
        width: canvas.width, height: canvas.height, strength: recovery,
      })
      const spots = edits.filter((edit): edit is Extract<TouchUpEdit, { kind: 'spot' }> =>
        edit.kind === 'spot').map(edit => edit.point)
      const rectangles = edits.filter((edit): edit is Extract<TouchUpEdit, { kind: 'sweep' }> =>
        edit.kind === 'sweep').map(edit => edit.rectangle)
      const spotCorrected = removeSkySpots(original.data, recoveredMask, reversed,
        canvas.width, canvas.height, spots)
      const sweepCorrected = removeSkySweeps(original.data, spotCorrected, reversed,
        canvas.width, canvas.height, rectangles)
      const cutout = applySkyAlpha(original.data, sweepCorrected, reversed, {
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
  function scheduleRefinement(
    nextInvert: boolean, cleanup: number, decontaminate: boolean,
    recovery: MissedSkyStrength = skyRecovery,
    edits: TouchUpEdit[] = touchEdits,
  ) {
    setInvert(nextInvert)
    setEdgeCleanup(cleanup)
    setReduceHalo(decontaminate)
    setSkyRecovery(recovery)
    setTouchEdits(edits)
    const mask = maskBlob.current
    if (!mask) return
    const version = ++refineVersion.current
    if (refineTimer.current) clearTimeout(refineTimer.current)
    setRefining(true)
    refineTimer.current = setTimeout(() => {
      refineTimer.current = null
      void (async () => {
        try {
          const cutout = await composeFromMask(mask, nextInvert, cleanup, decontaminate,
            recovery, edits)
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

  function addSkySpot(event: MouseEvent<HTMLButtonElement>) {
    if (touchMode !== 'spot' || busy || !maskBlob.current || resultSource !== 'ai') return
    const img = previewImage.current
    if (!img || !img.naturalWidth || !img.naturalHeight) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
    const shownWidth = img.naturalWidth * scale
    const shownHeight = img.naturalHeight * scale
    const left = rect.left + (rect.width - shownWidth) / 2
    const top = rect.top + (rect.height - shownHeight) / 2
    const x = Math.floor((event.clientX - left) / scale)
    const y = Math.floor((event.clientY - top) / scale)
    if (x < 0 || y < 0 || x >= img.naturalWidth || y >= img.naturalHeight) return
    if (touchEdits.length >= 32) {
      setError('Maximum 32 touch-up operations. Undo an edit to continue.')
      return
    }
    scheduleRefinement(invert, edgeCleanup, reduceHalo, skyRecovery,
      [...touchEdits, { kind: 'spot', point: { x, y } }])
  }

  /** Map a pointer to the image pixels, compensating for object-fit: contain. */
  function imageCoords(event: PointerEvent<HTMLButtonElement>, clamp: boolean) {
    const image = previewImage.current
    if (!image || !image.naturalWidth || !image.naturalHeight) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
    if (scale <= 0) return null
    const left = (rect.width - image.naturalWidth * scale) / 2
    const top = (rect.height - image.naturalHeight * scale) / 2
    const rawX = (event.clientX - rect.left - left) / scale
    const rawY = (event.clientY - rect.top - top) / scale
    if (!clamp && (rawX < 0 || rawX >= image.naturalWidth ||
      rawY < 0 || rawY >= image.naturalHeight)) return null
    return {
      x: Math.max(0, Math.min(image.naturalWidth, rawX)),
      y: Math.max(0, Math.min(image.naturalHeight, rawY)),
      screenX: Math.max(left, Math.min(left + image.naturalWidth * scale,
        event.clientX - rect.left)),
      screenY: Math.max(top, Math.min(top + image.naturalHeight * scale,
        event.clientY - rect.top)),
    }
  }

  function startSweep(event: PointerEvent<HTMLButtonElement>) {
    if (touchMode !== 'sweep' || busy || !maskBlob.current ||
        event.button !== 0 || dragState.current) return
    const pos = imageCoords(event, false)
    if (!pos) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = { pointerId: event.pointerId, start: { x: pos.x, y: pos.y } }
    setDragBox({ left: pos.screenX, top: pos.screenY, width: 0, height: 0 })
  }

  function moveSweep(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const end = imageCoords(event, true)
    const image = previewImage.current
    if (!end || !image) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
    const x0 = (rect.width - image.naturalWidth * scale) / 2 + drag.start.x * scale
    const y0 = (rect.height - image.naturalHeight * scale) / 2 + drag.start.y * scale
    setDragBox({
      left: Math.min(x0, end.screenX), top: Math.min(y0, end.screenY),
      width: Math.abs(end.screenX - x0), height: Math.abs(end.screenY - y0),
    })
  }

  function cancelSweep() {
    dragState.current = null
    setDragBox(null)
  }

  function finishSweep(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const end = imageCoords(event, true)
    dragState.current = null
    setDragBox(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (!end || busy || touchMode !== 'sweep') return
    const rectangle = {
      x0: Math.floor(Math.min(drag.start.x, end.x)),
      y0: Math.floor(Math.min(drag.start.y, end.y)),
      x1: Math.ceil(Math.max(drag.start.x, end.x)),
      y1: Math.ceil(Math.max(drag.start.y, end.y)),
    }
    if (rectangle.x1 - rectangle.x0 < 3 || rectangle.y1 - rectangle.y0 < 3) return
    if (touchEdits.length >= 32) {
      setError('Maximum 32 touch-up operations. Undo an edit to continue.')
      return
    }
    scheduleRefinement(invert, edgeCleanup, reduceHalo, skyRecovery,
      [...touchEdits, { kind: 'sweep', rectangle }])
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
      const cutout = await composeFromMask(mask, false, edgeCleanup, reduceHalo, skyRecovery, [])
      if (abort.signal.aborted) return
      maskBlob.current = mask
      setTouchEdits([])
      setTouchMode('off')
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
      setTouchEdits([])
      setTouchMode('off')
      showResult(cutout, 'local')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Local removal failed.')
    } finally { setProcessing(false) }
  }

  function useOriginalTransparency() {
    refineVersion.current += 1
    if (refineTimer.current) clearTimeout(refineTimer.current)
    maskBlob.current = null
    setTouchEdits([])
    setTouchMode('off')
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
          <label htmlFor="sky-ai-missed-recovery">Recover missed bright sky</label>
          <select id="sky-ai-missed-recovery" value={skyRecovery} disabled={processing}
            onChange={event => scheduleRefinement(
              invert, edgeCleanup, reduceHalo, Number(event.target.value) as MissedSkyStrength,
            )}>
            <option value={0}>Off</option>
            <option value={1}>Low</option>
            <option value={2}>Medium</option>
            <option value={3}>High</option>
          </select>
          <button type="button" className="sky-ai-reset"
            aria-pressed={touchMode === 'spot'} disabled={busy}
            onClick={() => { setTouchMode(value => value === 'spot' ? 'off' : 'spot'); setDragBox(null) }}>
            {touchMode === 'spot' ? 'Done touching up' : 'Touch up white pockets'}
          </button>
          <button type="button" className="sky-ai-reset"
            aria-pressed={touchMode === 'sweep'} disabled={busy}
            onClick={() => { setTouchMode(value => value === 'sweep' ? 'off' : 'sweep'); setDragBox(null) }}>
            {touchMode === 'sweep' ? 'Done sweeping' : 'Sweep white pockets'}
          </button>
          {touchEdits.length > 0 && <button type="button" className="sky-ai-reset"
            disabled={busy}
            onClick={() => scheduleRefinement(invert, edgeCleanup, reduceHalo,
              skyRecovery, touchEdits.slice(0, -1))}>
            Undo edit ({touchEdits.length})
          </button>}
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
            onClick={() => scheduleRefinement(invert, 0, false, 0, [])}>Show raw AI mask</button>
        </div>
        <p>Missed-sky recovery removes bright white gaps in tree canopies using the original
          photo, then edge cleanup removes thin halos. Both are free, local adjustments.
          If branches disappear or buildings are affected, lower the recovery setting.
          “Show raw AI mask” turns both refinements off.</p>
      </div>}
      {touchMode === 'spot' && resultSource === 'ai' && <p className="sky-ai-status" role="status">
        Click a leftover white spot in the RIGHT preview. Each click is a free local edit;
        use Undo edit if you remove too much.
      </p>}
      {touchMode === 'sweep' && resultSource === 'ai' && <p className="sky-ai-status" role="status">
        Drag a rectangle around the tree canopy in the RIGHT preview. All bright sky-like
        gaps inside the box are cleaned in one free operation. Review pale buildings and use Undo edit if needed.
      </p>}
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
            {resultUrl ? <img ref={previewImage} src={resultUrl}
              alt="Complete skyline with removed sky shown transparent"/> :
              <div className="sky-ai-placeholder">The edited photo will appear here at its full aspect ratio.</div>}
            {touchMode !== 'off' && resultSource === 'ai' && resultUrl && <button
              type="button" className="sky-ai-spot-target"
              onClick={touchMode === 'spot' ? addSkySpot : undefined}
              onPointerDown={touchMode === 'sweep' ? startSweep : undefined}
              onPointerMove={touchMode === 'sweep' ? moveSweep : undefined}
              onPointerUp={touchMode === 'sweep' ? finishSweep : undefined}
              onPointerCancel={cancelSweep}
              aria-label={touchMode === 'sweep'
                ? 'Drag to draw a sky-cleanup rectangle on the photo'
                : 'Click a bright sky pocket to remove it'}
              disabled={busy} title={touchMode === 'sweep'
                ? 'Drag a rectangle around remaining white sky pockets'
                : 'Click a remaining white sky pocket'}/>}
            {dragBox && touchMode === 'sweep' && <div className="sky-ai-drag-rect"
              aria-hidden="true" style={dragBox}/>}
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
