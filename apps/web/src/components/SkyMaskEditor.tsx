import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { hasTransparentSky, maskWhiteSkyPixels } from '../skyCutout'
import {
  changeRegionAlpha, colorRegion, composeSkyCutout, fillMaskPolygon,
  getAlpha, maskWorkingDimensions, paintAlphaLine,
} from '../skyMaskMath'
import type { MaskPoint } from '../skyMaskMath'
import { resampleSkyAlpha } from '../skyWorkshopMath'
import type { SkyAlphaMask } from '../skyWorkshopMath'
import { smartRectangleCleanup } from '../skyWorkshopMask'
import './SkyMaskEditor.css'

type Tool = 'smart' | 'brush' | 'polygon'
type Preview = 'overlay' | 'cutout' | 'night'
type Props = {
  file: File
  initialMask?: Uint8ClampedArray | null
  detectedMask?: SkyAlphaMask | null
  showPolishGuide?: boolean
  onDismissPolishGuide?: () => void
  onApply: (png: Blob, alpha: Uint8ClampedArray) => void
  onClose: () => void
}
type LoadedPhoto = { width: number; height: number }
const MAX_HISTORY = 12

/** Photo and its undo history stay in this browser tab; no upload or image service. */
export function SkyMaskEditor({
  file, initialMask, detectedMask, showPolishGuide = false, onDismissPolishGuide,
  onApply, onClose,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const photo = useRef<Uint8ClampedArray | null>(null)
  const automatic = useRef<Uint8ClampedArray | null>(null)
  const initialAlpha = useRef<Uint8ClampedArray | null>(null)
  const smartDrag = useRef<{start:MaskPoint;latest:MaskPoint;pointerId:number}|null>(null)
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
  const [tool, setTool] = useState<Tool>('smart')
  const [dragBox,setDragBox] = useState<{left:string;top:string;width:string;height:string}|null>(null)
  const [operation, setOperation] = useState<'remove' | 'restore'>('remove')
  const [preview, setPreview] = useState<Preview>('overlay')
  const [zoom, setZoom] = useState(100)
  const [tolerance, setTolerance] = useState(22)
  const [contiguous, setContiguous] = useState(true)
  const [brushSize, setBrushSize] = useState(22)
  const [vertices, setVertices] = useState<MaskPoint[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  const [message, setMessage] = useState('Click a missed sky pocket to clean it. Drag over a larger area to clean light gaps while preserving darker branches. Switch to Restore to bring anything back.')

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
          ? new Uint8ClampedArray(initialMask)
          : detectedMask ? resampleSkyAlpha(detectedMask, width, height) : getAlpha(prepared)
        initialAlpha.current = new Uint8ClampedArray(alpha.current)
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
  }, [file, initialMask, detectedMask])

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
      output.data.set(composeSkyCutout(original, auto, mask, loaded.width, loaded.height))
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
    onDismissPolishGuide?.()
    const p=position(event)
    if(tool==='polygon'){
      setVertices(points=>[...points,p])
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    if(tool==='smart'){
      smartDrag.current={start:p,latest:p,pointerId:event.pointerId}
      setDragBox(null)
      return
    }
    saveHistory()
    painting.current=true
    lastPointer.current=p
    paintAlphaLine(alpha.current,photo.current,loaded.width,loaded.height,
      p.x,p.y,p.x,p.y,brushSize/2,operation==='restore')
    scheduleDraw()
  }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if(!loaded)return
    const p=position(event)
    const drag=smartDrag.current
    if(tool==='smart'&&drag&&drag.pointerId===event.pointerId){
      drag.latest=p
      if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<6){setDragBox(null);return}
      const left=Math.min(p.x,drag.start.x),right=Math.max(p.x,drag.start.x)
      const top=Math.min(p.y,drag.start.y),bottom=Math.max(p.y,drag.start.y)
      setDragBox({left:`${left/loaded.width*100}%`,top:`${top/loaded.height*100}%`,
        width:`${(right-left)/loaded.width*100}%`,height:`${(bottom-top)/loaded.height*100}%`})
      return
    }
    if(!painting.current||!alpha.current||!photo.current||!lastPointer.current)return
    paintAlphaLine(alpha.current,photo.current,loaded.width,loaded.height,
      lastPointer.current.x,lastPointer.current.y,p.x,p.y,brushSize/2,operation==='restore')
    lastPointer.current=p
    scheduleDraw()
  }
  function pointerEnd(event:ReactPointerEvent<HTMLCanvasElement>) {
    if(tool==='smart'&&smartDrag.current&&loaded&&alpha.current&&photo.current){
      const drag=smartDrag.current
      if(event.pointerId!==drag.pointerId)return
      smartDrag.current=null
      setDragBox(null)
      const end=position(event),dx=Math.abs(end.x-drag.start.x),dy=Math.abs(end.y-drag.start.y)
      saveHistory()
      let changed:number
      if(Math.hypot(dx,dy)>=6){
        changed=smartRectangleCleanup(photo.current,alpha.current,loaded.width,loaded.height,
          {x0:drag.start.x,y0:drag.start.y,x1:end.x+1,y1:end.y+1},operation==='restore')
        setMessage(changed?
          `${changed.toLocaleString()} pixels ${operation==='restore'?'restored':'cleaned'} inside your rectangle.`:
          'No light sky pockets found in this area. Click a single patch or adjust the tolerance.')
      }else{
        const selection=colorRegion(photo.current,loaded.width,loaded.height,
          end.x,end.y,tolerance,contiguous)
        changed=changeRegionAlpha(alpha.current,selection,photo.current,operation==='restore')
        setMessage(changed?
          `${changed.toLocaleString()} pixels ${operation==='restore'?'restored':'cleaned'} in the selected region.`:
          'No change here. Try a different spot or adjust tolerance.')
      }
      scheduleDraw()
    }
    painting.current=false
    lastPointer.current=null
  }
  function pointerCancel() {
    smartDrag.current=null
    setDragBox(null)
    painting.current=false
    lastPointer.current=null
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
    alpha.current = new Uint8ClampedArray(initialAlpha.current ?? getAlpha(automatic.current))
    setVertices([])
    setMessage('The initial AI horizon selection has been restored. You can refine it again.')
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
      pixels.data.set(composeSkyCutout(photo.current, automatic.current, alpha.current, loaded.width, loaded.height))
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
          <h2>Polish your photograph</h2>
          <p>We've marked the likely sky in blue. Simply click a missed patch to clean it or drag a rectangle to tidy several bright pockets at once. Restore details anytime.</p>
        </div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close sky editor">✕</button>
      </header>
      <div className="sky-mask-intro">{detectedMask ?
        'AI made a careful first pass. Click to select a connected sky patch or drag to sweep a rectangle; both work automatically.'
        : 'Use one click to select a region, or drag a rectangle to clean several bright pockets.'}</div>
      <div className="sky-mask-tools" aria-label="Sky mask editing tools"
        onPointerDown={onDismissPolishGuide}>
        <div className="sky-mask-tool-buttons" role="group" aria-label="Choose editing tool">
          {(['smart','brush','polygon'] as const).map(item =>
            <button key={item} type="button" aria-pressed={tool === item} className={tool === item ? 'active' : ''}
              onClick={() => { setTool(item); setVertices([]);setDragBox(null) }}>
              {item === 'smart' ? '✦ Smart cleanup · click or drag' : item === 'brush' ? '◉ Fine brush' : '⬡ Trace area'}
            </button>)}
        </div>
        <div className="sky-mask-tool-buttons sky-mask-actions" role="group" aria-label="Clean sky or restore photograph">
          <button type="button" className={operation==='remove'?'active':''}
            aria-pressed={operation==='remove'} onClick={()=>setOperation('remove')}>✦ Clean remaining sky</button>
          <button type="button" className={operation==='restore'?'active':''}
            aria-pressed={operation==='restore'} onClick={()=>setOperation('restore')}>↶ Restore photograph</button>
        </div>
        {tool === 'smart' && <>
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
              aria-label="Photo editor. Click to clean one region, or drag to draw a rectangle. Choose Restore to bring back the original photo."
              onPointerDown={pointerDown} onPointerMove={pointerMove}
              onPointerUp={pointerEnd} onPointerCancel={pointerCancel}
              onLostPointerCapture={pointerCancel}/>
            {dragBox && <div className="sky-mask-smart-rect" style={dragBox} aria-hidden="true"/>}
            {showPolishGuide && tool==='smart' && !dragBox && <div
              className="sky-mask-gesture-guide" aria-hidden="true">
              <div className="sky-mask-gesture-tap"/>
              <div className="sky-mask-gesture-sweep"/>
              <div className="sky-mask-gesture-hand">
                <svg viewBox="0 0 32 39" width="31" height="38" aria-hidden="true">
                  <path d="M5 2v24l6.4-5.5 5.2 13.7 6.6-3.1-5.4-12.9 9.6.6Z"
                    fill="#fff6dc" stroke="#092638" strokeWidth="1.9"
                    strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="sky-mask-gesture-copy">
                <strong>A little polish makes the difference</strong>
                <span><b>Click</b> a bright sky patch to clean it.</span>
                <span><b>Drag</b> to sweep multiple gaps. Use Restore for details.</span>
              </div>
            </div>}
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
        {showPolishGuide && <button type="button"
          className="sky-mask-dismiss-hint" onClick={()=>onDismissPolishGuide?.()}>
          Got it — start polishing
        </button>}
        <small className="sky-mask-disclosure">Cyan shows the selected sky. Clicking cleans one connected region; dragging cleans bright gaps within your rectangle, without stripping dark branches. Restore works with the same gestures. Zoom for tiny details, undo mistakes, then save. The original photo is preserved in your browser.</small>
      </div>
      {error && <p className="sky-mask-error" role="alert">{error}</p>}
      <footer className="sky-mask-footer">
        <div className="sky-mask-history">
          <button type="button" disabled={!undoCount} onClick={undo}>↶ Undo</button>
          <button type="button" disabled={!redoCount} onClick={redo}>↷ Redo</button>
          <button type="button" disabled={!loaded} onClick={resetMask}>Reset to AI selection</button>
          <button type="button" disabled={!loaded} onClick={restoreOriginal}>Restore original</button>
        </div>
        <div className="sky-mask-save">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="sky-mask-primary" disabled={!loaded || saving}
            onClick={() => { void exportImage() }}>{saving ? 'Preparing…' : 'Save my sky & continue'}</button>
        </div>
      </footer>
    </section>
  </div>
}
