import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { hasTransparentSky, maskWhiteSkyPixels } from '../skyCutout'
import {
  changeRegionAlpha, colorRegion, composeSkyCutout, fillMaskPolygon,
  getAlpha, maskWorkingDimensions, paintAlphaLine,
} from '../skyMaskMath'
import type { MaskPoint } from '../skyMaskMath'
import './SkyMaskEditor.css'

type Tool = 'wand' | 'brush' | 'polygon'
type Preview = 'overlay' | 'cutout' | 'night'
type Props = {
  file: File
  initialMask?: Uint8ClampedArray | null
  onApply: (png: Blob, alpha: Uint8ClampedArray) => void
  onClose: () => void
}
type LoadedPhoto = { width: number; height: number }
const MAX_HISTORY = 12

/** Photo and its undo history stay in this browser tab; no upload or image service. */
export function SkyMaskEditor({ file, initialMask, onApply, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const photo = useRef<Uint8ClampedArray | null>(null)
  const automatic = useRef<Uint8ClampedArray | null>(null)
  const alpha = useRef<Uint8ClampedArray | null>(null)
  const past = useRef<Uint8ClampedArray[]>([])
  const future = useRef<Uint8ClampedArray[]>([])
  const lastPointer = useRef<MaskPoint | null>(null)
  const painting = useRef(false)
  const redrawFrame = useRef<number | null>(null)
  const closeButton = useRef<HTMLButtonElement>(null)

  const [loaded, setLoaded] = useState<LoadedPhoto | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tool, setTool] = useState<Tool>('wand')
  const [operation, setOperation] = useState<'remove' | 'restore'>('remove')
  const [preview, setPreview] = useState<Preview>('overlay')
  const [zoom, setZoom] = useState(100)
  const [tolerance, setTolerance] = useState(22)
  const [contiguous, setContiguous] = useState(true)
  const [brushSize, setBrushSize] = useState(22)
  const [vertices, setVertices] = useState<MaskPoint[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  const [message, setMessage] = useState('Auto-detect removes top-connected near-white sky. Click a missed sky patch or trace the horizon to refine it.')

  useEffect(() => {
    let cancelled = false
    let bitmap: ImageBitmap | null = null
    closeButton.current?.focus()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    async function load() {
      try {
        bitmap = await createImageBitmap(file)
        if (cancelled) return
        const { width, height } = maskWorkingDimensions(bitmap.width, bitmap.height)
        const work = document.createElement('canvas')
        work.width = width
        work.height = height
        const context = work.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('The browser cannot read this image.')
        context.drawImage(bitmap, 0, 0, width, height)
        const original = context.getImageData(0, 0, width, height).data
        const prepared = hasTransparentSky(original)
          ? new Uint8ClampedArray(original)
          : maskWhiteSkyPixels(original, width, height)
        photo.current = new Uint8ClampedArray(original)
        automatic.current = prepared
        alpha.current = initialMask?.length === width * height
          ? new Uint8ClampedArray(initialMask) : getAlpha(prepared)
        past.current = []
        future.current = []
        if (!cancelled) setLoaded({ width, height })
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open this photo.')
      } finally {
        bitmap?.close()
      }
    }
    void load()
    return () => {
      cancelled = true
      document.body.style.overflow = oldOverflow
      if (redrawFrame.current !== null) cancelAnimationFrame(redrawFrame.current)
    }
  }, [file, initialMask])

  const draw = useCallback(() => {
    const original = photo.current
    const auto = automatic.current
    const mask = alpha.current
    const element = canvas.current
    if (!original || !auto || !mask || !element || !loaded) return
    const ctx = element.getContext('2d')
    if (!ctx) return
    if (element.width !== loaded.width || element.height !== loaded.height) {
      element.width = loaded.width
      element.height = loaded.height
    }
    const output = ctx.createImageData(loaded.width, loaded.height)
    if (preview === 'overlay') {
      for (let i=0; i<mask.length; i++) {
        const j=i*4
        const hidden = 1 - mask[i] / 255
        output.data[j] = Math.round(original[j] * (1 - hidden*.58) + 31 * hidden*.58)
        output.data[j+1] = Math.round(original[j+1] * (1 - hidden*.58) + 216 * hidden*.58)
        output.data[j+2] = Math.round(original[j+2] * (1 - hidden*.58) + 212 * hidden*.58)
        output.data[j+3] = 255
      }
    } else {
      output.data.set(composeSkyCutout(original, auto, mask))
    }
    ctx.putImageData(output, 0, 0)
  }, [loaded, preview])

  useEffect(() => { draw() }, [draw])

  function scheduleDraw() {
    if (redrawFrame.current !== null) return
    redrawFrame.current = requestAnimationFrame(() => {
      redrawFrame.current = null
      draw()
    })
  }

  function saveHistory() {
    if (!alpha.current) return
    past.current.push(new Uint8ClampedArray(alpha.current))
    if (past.current.length > MAX_HISTORY) past.current.shift()
    future.current = []
    setUndoCount(past.current.length)
    setRedoCount(0)
  }
  function undo() {
    const previous = past.current.pop()
    if (!previous || !alpha.current) return
    future.current.push(alpha.current)
    alpha.current = previous
    setUndoCount(past.current.length)
    setRedoCount(future.current.length)
    setVertices([])
    scheduleDraw()
  }
  function redo() {
    const next = future.current.pop()
    if (!next || !alpha.current) return
    past.current.push(alpha.current)
    alpha.current = next
    setUndoCount(past.current.length)
    setRedoCount(future.current.length)
    setVertices([])
    scheduleDraw()
  }

  function position(event: ReactPointerEvent<HTMLCanvasElement>): MaskPoint {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(loaded!.width-1, Math.floor((event.clientX - rect.left) / rect.width * loaded!.width))),
      y: Math.max(0, Math.min(loaded!.height-1, Math.floor((event.clientY - rect.top) / rect.height * loaded!.height))),
    }
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || !loaded || !alpha.current || !photo.current) return
    event.preventDefault()
    const p = position(event)
    if (tool === 'polygon') {
      setVertices(points => [...points, p])
      return
    }
    if (tool === 'wand') {
      const selection = colorRegion(photo.current, loaded.width, loaded.height, p.x, p.y, tolerance, contiguous)
      saveHistory()
      const changed = changeRegionAlpha(alpha.current, selection, photo.current, operation === 'restore')
      setMessage(changed ? `${changed.toLocaleString()} pixels ${operation === 'restore' ? 'restored' : 'removed'}. Click another region or refine with the brush.` : 'No change at this point. Try a different spot or tolerance.')
      scheduleDraw()
      return
    }
    saveHistory()
    painting.current = true
    lastPointer.current = p
    event.currentTarget.setPointerCapture(event.pointerId)
    paintAlphaLine(alpha.current, photo.current, loaded.width, loaded.height,
      p.x, p.y, p.x, p.y, brushSize / 2, operation === 'restore')
    scheduleDraw()
  }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!painting.current || !loaded || !alpha.current || !photo.current || !lastPointer.current) return
    const p = position(event)
    paintAlphaLine(alpha.current, photo.current, loaded.width, loaded.height,
      lastPointer.current.x, lastPointer.current.y, p.x, p.y, brushSize / 2, operation === 'restore')
    lastPointer.current = p
    scheduleDraw()
  }
  function pointerEnd() {
    painting.current = false
    lastPointer.current = null
  }
  function applyPolygon() {
    if (!loaded || !alpha.current || !photo.current || vertices.length < 3) return
    saveHistory()
    const changed = fillMaskPolygon(alpha.current, photo.current, loaded.width, loaded.height, vertices, operation === 'restore')
    setMessage(`${changed.toLocaleString()} pixels ${operation === 'restore' ? 'restored' : 'removed'} within your traced area.`)
    setVertices([])
    scheduleDraw()
  }
  function resetMask() {
    if (!automatic.current || !alpha.current) return
    saveHistory()
    alpha.current = getAlpha(automatic.current)
    setVertices([])
    setMessage('Automatic sky detection restored. You can continue refining it.')
    scheduleDraw()
  }
  function restoreOriginal() {
    if (!photo.current || !alpha.current) return
    saveHistory()
    alpha.current = getAlpha(photo.current)
    setVertices([])
    setMessage('Original photo restored. Start removing sky again.')
    scheduleDraw()
  }
  async function exportImage() {
    if (!loaded || !photo.current || !automatic.current || !alpha.current || saving) return
    setSaving(true)
    setError('')
    try {
      const output = document.createElement('canvas')
      output.width = loaded.width
      output.height = loaded.height
      const ctx = output.getContext('2d')
      if (!ctx) throw new Error('Could not export the edited mask.')
      const pixels = ctx.createImageData(loaded.width, loaded.height)
      pixels.data.set(composeSkyCutout(photo.current, automatic.current, alpha.current))
      ctx.putImageData(pixels, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => {
        output.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png')
      })
      onApply(blob, new Uint8ClampedArray(alpha.current))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not apply this mask.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="sky-mask-backdrop" onPointerDown={event => event.stopPropagation()}>
    <section role="dialog" aria-modal="true" aria-label="Edit your photo horizon and sky mask"
      className="sky-mask-dialog"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose() }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault()
          if (event.shiftKey) redo()
          else undo()
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
          event.preventDefault(); redo()
        }
      }}>
      <header className="sky-mask-header">
        <div>
          <span className="sky-mask-eyebrow">Your photo · free local editing</span>
          <h2>Detect the horizon & edit the sky</h2>
          <p>Bright white sky is detected automatically when the photo opens. Correct the mask with the magic wand, brush or traced areas. For colored sky, use the wand or trace the horizon manually.</p>
        </div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close sky editor">✕</button>
      </header>
      <div className="sky-mask-tools" aria-label="Sky mask editing tools">
        <div className="sky-mask-tool-buttons" role="group" aria-label="Choose editing tool">
          {(['wand', 'brush', 'polygon'] as const).map(item =>
            <button key={item} type="button" aria-pressed={tool === item} className={tool === item ? 'active' : ''}
              onClick={() => { setTool(item); setVertices([]) }}>
              {item === 'wand' ? '✦ Magic wand' : item === 'brush' ? '◉ Brush' : '⬡ Trace area'}
            </button>)}
        </div>
        <label>Action
          <select value={operation} onChange={event => setOperation(event.target.value as 'remove' | 'restore')}>
            <option value="remove">Remove sky</option>
            <option value="restore">Restore photo</option>
          </select>
        </label>
        {tool === 'wand' && <>
          <label>Tolerance <strong>{tolerance}</strong>
            <input type="range" min="0" max="100" value={tolerance}
              onChange={event => setTolerance(Number(event.target.value))}/>
          </label>
          <label className="sky-mask-check"><input type="checkbox" checked={contiguous}
            onChange={event => setContiguous(event.target.checked)}/> Connected pixels only</label>
        </>}
        {tool === 'brush' && <label>Brush size <strong>{brushSize} px</strong>
          <input type="range" min="3" max="120" value={brushSize}
            onChange={event => setBrushSize(Number(event.target.value))}/>
        </label>}
        {tool === 'polygon' && <div className="sky-mask-polygon-buttons">
          <span>{vertices.length} corners</span>
          <button type="button" disabled={vertices.length < 3} onClick={applyPolygon}>Apply traced area</button>
          <button type="button" disabled={!vertices.length} onClick={() => setVertices([])}>Clear points</button>
        </div>}
      </div>
      <div className="sky-mask-workspace">
        <div className="sky-mask-preview-switch" role="group" aria-label="Mask preview mode">
          {(['overlay','cutout','night'] as const).map(item =>
            <button key={item} type="button" aria-pressed={preview === item}
              onClick={() => setPreview(item)} className={preview === item ? 'active' : ''}>
              {item === 'overlay' ? 'Mask overlay' : item === 'cutout' ? 'Transparency' : 'Night preview'}
            </button>)}
          <label className="sky-mask-zoom">Zoom
            <select value={zoom} onChange={event => setZoom(Number(event.target.value))}>
              <option value={100}>100%</option>
              <option value={150}>150%</option>
              <option value={200}>200%</option>
              <option value={300}>300%</option>
            </select>
          </label>
        </div>
        <div className="sky-mask-canvas-scroll">
        <div className={`sky-mask-canvas-shell sky-mask-${preview}`}
          style={{ width: `${zoom}%` }}>
          {loaded ? <>
            <canvas ref={canvas} width={loaded.width} height={loaded.height}
              aria-label="Skyline image mask editing canvas. Click to select pixels or draw over regions."
              onPointerDown={pointerDown} onPointerMove={pointerMove}
              onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
              onLostPointerCapture={pointerEnd}/>
            {tool === 'polygon' && vertices.length > 0 &&
              <svg className="sky-mask-polygon-overlay" viewBox={`0 0 ${loaded.width} ${loaded.height}`}
                preserveAspectRatio="none" aria-hidden="true">
                <polyline points={vertices.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke="#f1c779" strokeWidth={Math.max(2, loaded.width/500)}
                  strokeDasharray="14 7"/>
                {vertices.map((p, index) => <circle key={index} cx={p.x} cy={p.y}
                  r={Math.max(4, loaded.width/290)} fill="#ffe0a3" stroke="#15222e" strokeWidth="2"/>)}
              </svg>}
          </> : <div className="sky-mask-loading" role="status">{error || 'Preparing full-resolution photo…'}</div>}
        </div>
        </div>
        <div className="sky-mask-under-preview" role="status">{message}</div>
        <small className="sky-mask-disclosure">Cyan marks transparent sky. The full image is shown at 100% zoom; zoom in for gaps between branches. Night preview is illustrative; your calculated stars appear in the frame once you apply. All manual changes stay in your browser.</small>
      </div>
      {error && <p className="sky-mask-error" role="alert">{error}</p>}
      <footer className="sky-mask-footer">
        <div className="sky-mask-history">
          <button type="button" disabled={!undoCount} onClick={undo}>↶ Undo</button>
          <button type="button" disabled={!redoCount} onClick={redo}>↷ Redo</button>
          <button type="button" disabled={!loaded} onClick={resetMask}>Detect bright sky again</button>
          <button type="button" disabled={!loaded} onClick={restoreOriginal}>Restore original</button>
        </div>
        <div className="sky-mask-save">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="sky-mask-primary" disabled={!loaded || saving}
            onClick={() => { void exportImage() }}>{saving ? 'Saving…' : 'Apply to night sky'}</button>
        </div>
      </footer>
    </section>
  </div>
}
