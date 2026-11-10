import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { hasTransparentSky, maskWhiteSkyPixels } from '../skyCutout'
import {
  changeRegionAlpha, colorRegion, composeSkyCutout, fillMaskPolygon,
  getAlpha, maskWorkingDimensions, paintLikelySkyLine,
  appendFreehandPoint, isUsableFreehandArea, pointInMaskPolygon,
} from '../skyMaskMath'
import type { MaskPoint } from '../skyMaskMath'
import { resampleSkyAlpha } from '../skyWorkshopMath'
import type { SkyAlphaMask } from '../skyWorkshopMath'
import { smartRectangleCleanup } from '../skyWorkshopMask'
import type { ChapterIndex } from '../workshopNavigation'
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
  onChapterNavigate?: (chapter: ChapterIndex) => void
  chapterNotice?: string | null
}
type LoadedPhoto = { width: number; height: number }
const MAX_HISTORY = 12

/** Photo and its undo history stay in this browser tab; no upload or image service. */
export function SkyMaskEditor({
  file, initialMask, detectedMask, showPolishGuide = false, onDismissPolishGuide,
  onApply, onClose, onChapterNavigate, chapterNotice,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const photo = useRef<Uint8ClampedArray | null>(null)
  const automatic = useRef<Uint8ClampedArray | null>(null)
  const initialAlpha = useRef<Uint8ClampedArray | null>(null)
  const smartDrag = useRef<{start:MaskPoint;latest:MaskPoint;pointerId:number}|null>(null)
  const freehandDrag = useRef<{pointerId:number;points:MaskPoint[]}|null>(null)
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
  const [traceReady,setTraceReady]=useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  const [message, setMessage] = useState('Sky Spot Finder: click a sky-colored spot or drag a box over missed patches. Choose Add to sky or Keep as photo. Your original is never overwritten.')

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
    setTraceReady(false)
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
    setTraceReady(false)
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
      if(traceReady && pointInMaskPolygon(p,vertices)){
        applyPolygon(operation==='restore')
        return
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      freehandDrag.current={pointerId:event.pointerId,points:[p]}
      setTraceReady(false)
      setVertices([p])
      setMessage('Hold and drag all the way around an area, then release to close the outline.')
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
    paintLikelySkyLine(alpha.current,photo.current,loaded.width,loaded.height,
      p.x,p.y,p.x,p.y,brushSize/2,operation==='restore')
    scheduleDraw()
  }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if(!loaded)return
    const p=position(event)
    const trace=freehandDrag.current
    if(tool==='polygon'&&trace&&trace.pointerId===event.pointerId){
      const points=appendFreehandPoint(trace.points,p,2,900)
      if(points!==trace.points){
        trace.points=points
        setVertices(points)
      }
      return
    }
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
    paintLikelySkyLine(alpha.current,photo.current,loaded.width,loaded.height,
      lastPointer.current.x,lastPointer.current.y,p.x,p.y,brushSize/2,operation==='restore')
    lastPointer.current=p
    scheduleDraw()
  }
  function pointerEnd(event:ReactPointerEvent<HTMLCanvasElement>) {
    const trace=freehandDrag.current
    if(tool==='polygon' && trace && trace.pointerId===event.pointerId){
      freehandDrag.current=null
      const outline=appendFreehandPoint(trace.points,position(event),2,900)
      if(isUsableFreehandArea(outline)){
        setVertices(outline)
        setTraceReady(true)
        setMessage('Outline closed. Select Add to sky or Keep as photo, then click inside the outline or use a button below.')
      }else{
        setVertices([])
        setTraceReady(false)
        setMessage('Trace a full closed area by holding and dragging. Make a larger loop around the part you want to change.')
      }
      return
    }
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
    if(freehandDrag.current){
      freehandDrag.current=null
      setVertices([])
      setTraceReady(false)
    }
    smartDrag.current=null
    setDragBox(null)
    painting.current=false
    lastPointer.current=null
  }
  function applyPolygon(restore=operation==='restore') {
    if (!loaded || !alpha.current || !photo.current || !traceReady || !isUsableFreehandArea(vertices)) return
    saveHistory()
    const changed = fillMaskPolygon(alpha.current, photo.current, loaded.width, loaded.height, vertices, restore)
    setMessage(changed
      ? `${changed.toLocaleString()} pixels ${restore?'kept in the original photograph':'added to the night sky'} inside your hand-traced selection. Undo is available.`
      : 'This selection was already set that way. Trace another area or try Undo.')
    setVertices([])
    setTraceReady(false)
    scheduleDraw()
  }
  function resetMask() {
    if (!automatic.current || !alpha.current) return
    saveHistory()
    alpha.current = new Uint8ClampedArray(initialAlpha.current ?? getAlpha(automatic.current))
    setVertices([])
    setTraceReady(false)
    setMessage('The original detected-sky selection is back. You can refine it again.')
    scheduleDraw()
  }
  function restoreOriginal() {
    if (!photo.current || !alpha.current) return
    saveHistory()
    alpha.current = getAlpha(photo.current)
    setVertices([])
    setTraceReady(false)
    setMessage('All of your original photo is visible again. Add chosen spots to the sky when ready.')
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
      {onChapterNavigate&&<nav className="sky-mask-chapters" aria-label="Jump to another workshop chapter">
        {(['Photograph','Horizon','Moment','Your sky','Keepsake'] as const).map((label,index)=>
          <button type="button" key={label} aria-label={`Chapter ${index+1}: ${label}`}
            aria-current={index===1?'step':undefined}
            onClick={()=>onChapterNavigate(index as ChapterIndex)}>
            <span>{String(index+1).padStart(2,'0')}</span> {label}
          </button>)}
      </nav>}
      {chapterNotice&&<p className="sky-mask-chapter-notice" role="status">{chapterNotice}</p>}
      <header className="sky-mask-header">
        <div>
          <span className="sky-mask-eyebrow">Your photo · free local editing</span>
          <h2>Polish your photograph</h2>
          <p>Choose where stars should appear. Sky Spot Finder selects likely sky, Sky Edge Brush protects details, and Freehand Lasso lets you outline an exact area. Every edit can be undone.</p>
        </div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close sky editor">✕</button>
      </header>
      <div className="sky-mask-intro" role="status">
        {tool==='smart'
          ? '01 · Sky Spot Finder — click a likely sky pocket or drag a rectangle. The color-aware cleanup favors sky and leaves darker branches intact.'
          : tool==='brush'
            ? '02 · Sky Edge Brush — hold and paint along missed sky edges. It only clears pixels that appear sky-colored; use the lasso for dark or tricky areas.'
            : '03 · Freehand Lasso — hold and drag a loop around any region. Release, choose Add to sky or Keep as photo, then click inside the outline to apply.'}
      </div>
      <div className="sky-mask-tools" aria-label="Sky mask editing tools"
        onPointerDown={onDismissPolishGuide}>
        <div className="sky-mask-tool-buttons" role="group" aria-label="Choose editing tool">
          {(['smart','brush','polygon'] as const).map(item =>
            <button key={item} type="button" aria-pressed={tool === item} className={tool === item ? 'active' : ''}
              onClick={() => { setTool(item); setVertices([]);setTraceReady(false);setDragBox(null);freehandDrag.current=null }}>
              {item === 'smart' ? '✦ Sky Spot Finder' : item === 'brush' ? '◉ Sky Edge Brush' : '⬡ Freehand Lasso'}
            </button>)}
        </div>
        <div className="sky-mask-tool-buttons sky-mask-actions" role="group" aria-label="Clean sky or restore photograph">
          <button type="button" className={operation==='remove'?'active':''}
            aria-pressed={operation==='remove'} onClick={()=>setOperation('remove')}>✦ Add to sky · stars here</button>
          <button type="button" className={operation==='restore'?'active':''}
            aria-pressed={operation==='restore'} onClick={()=>setOperation('restore')}>◎ Keep in photo · protect details</button>
        </div>
        {tool === 'smart' && <>
          <label>Tolerance <strong>{tolerance}</strong>
            <input type="range" min="0" max="100" value={tolerance}
              onChange={event => setTolerance(Number(event.target.value))}/>
          </label>
          <label className="sky-mask-check"><input type="checkbox" checked={contiguous}
            onChange={event => setContiguous(event.target.checked)}/> Connected pixels only</label>
        </>}
        {tool === 'brush' && <label>Sky-aware brush size <strong>{brushSize} px</strong>
          <input type="range" min="3" max="120" value={brushSize}
            onChange={event => setBrushSize(Number(event.target.value))}/>
        </label>}
        {tool === 'polygon' && <div className="sky-mask-polygon-buttons">
          <span>{traceReady?'Outline ready':freehandDrag.current?'Drawing outline…':'Hold and trace a closed loop'}</span>
          <button type="button" disabled={!traceReady} onClick={()=>applyPolygon(false)}>✦ Add traced area to sky</button>
          <button type="button" disabled={!traceReady} onClick={()=>applyPolygon(true)}>◎ Keep traced area in photo</button>
          <button type="button" disabled={!vertices.length}
            onClick={() => {setVertices([]);setTraceReady(false)}}>Clear outline</button>
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
              aria-label="Photo sky editor. Sky Spot Finder: click or drag a rectangle; Sky Edge Brush: paint sky-colored edges; Freehand Lasso: hold and drag an outline, then choose Add to sky or Keep in photo."
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
                {traceReady
                  ? <polygon points={vertices.map(p=>`${p.x},${p.y}`).join(' ')}
                      fill="rgba(49,211,233,.18)" stroke="#ffe0a3"
                      strokeWidth={Math.max(2,loaded.width/700)} strokeDasharray="9 6"/>
                  : <polyline points={vertices.map(p=>`${p.x},${p.y}`).join(' ')}
                      fill="none" stroke="#ffe0a3" strokeWidth={Math.max(2,loaded.width/700)}
                      strokeDasharray="9 6"/>}
              </svg>}
          </> : <div className="sky-mask-loading" role="status">{error || 'Preparing full-resolution photo…'}</div>}
        </div>
        </div>
        <div className="sky-mask-under-preview" role="status">{message}</div>
        {showPolishGuide && <button type="button"
          className="sky-mask-dismiss-hint" onClick={()=>onDismissPolishGuide?.()}>
          Got it — start polishing
        </button>}
        <small className="sky-mask-disclosure">Cyan marks what becomes open night sky: stars appear there. Select Add to sky to clear a likely sky spot or paint edges; use Freehand Lasso for exact manual control. Keep in photo protects faces, buildings and trees. Undo, redo, and restore original are always available.</small>
      </div>
      {error && <p className="sky-mask-error" role="alert">{error}</p>}
      <footer className="sky-mask-footer">
        <div className="sky-mask-history">
          <button type="button" disabled={!undoCount} title="Undo last sky edit (Ctrl/Cmd+Z)" onClick={undo}>↶ Undo last edit</button>
          <button type="button" disabled={!redoCount} title="Redo sky edit (Ctrl/Cmd+Shift+Z)" onClick={redo}>↷ Redo edit</button>
          <button type="button" disabled={!loaded} onClick={resetMask}>Reset to detected sky</button>
          <button type="button" disabled={!loaded} onClick={restoreOriginal}>Restore entire original photo</button>
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
