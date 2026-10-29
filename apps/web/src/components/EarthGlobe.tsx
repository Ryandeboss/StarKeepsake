import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import {
  CONTINENT_SILHOUETTES,
  EXPLORER_LOCATIONS,
  clampLatitude,
  normalizedLongitude,
  orthographicProject,
} from '../skyExplorerData'
import type { ExplorerLocation } from '../skyExplorerData'

type Props = {
  selected: ExplorerLocation
  onSelect: (location: ExplorerLocation) => void
  onEnterSky: () => void
}

const SIZE = 540
const CENTER = SIZE / 2
const RADIUS = 214

function drawGlobe(
  context: CanvasRenderingContext2D,
  latitude: number,
  longitude: number,
  selectedId: string,
) {
  const ctx = context
  ctx.clearRect(0, 0, SIZE, SIZE)

  // Distant star particles are decorative, not the calculated sky.
  for (let i = 0; i < 90; i++) {
    const x = ((i * 131.31) % 519) + 9
    const y = ((i * 217.17) % 527) + 7
    ctx.globalAlpha = 0.12 + (i % 5) * .07
    ctx.fillStyle = '#d7e6f3'
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1)
  }
  ctx.globalAlpha = 1

  const halo = ctx.createRadialGradient(CENTER, CENTER, 125, CENTER, CENTER, 255)
  halo.addColorStop(0, 'rgba(66,163,216,0)')
  halo.addColorStop(.77, 'rgba(45,157,214,0.12)')
  halo.addColorStop(1, 'rgba(42,125,217,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(CENTER, CENTER, 255, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(CENTER, CENTER, RADIUS, 0, 2 * Math.PI)
  ctx.clip()

  const ocean = ctx.createRadialGradient(CENTER - 83, CENTER - 98, 8, CENTER + 35, CENTER + 35, 326)
  ocean.addColorStop(0, '#326b91')
  ocean.addColorStop(.45, '#16455e')
  ocean.addColorStop(.85, '#071e35')
  ocean.addColorStop(1, '#030d1f')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, SIZE, SIZE)

  const project = (lat: number, lon: number) => {
    const p = orthographicProject(lat, lon, latitude, longitude)
    return { x: CENTER + p.x * RADIUS, y: CENTER - p.y * RADIUS, visible: p.visible }
  }

  ctx.strokeStyle = 'rgba(176,222,240,.11)'
  ctx.lineWidth = .8
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath()
    let drawing = false
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = project(lat, lon)
      if (!p.visible) { drawing = false; continue }
      if (drawing) ctx.lineTo(p.x, p.y)
      else { ctx.moveTo(p.x, p.y); drawing = true }
    }
    ctx.stroke()
  }
  for (let lon = -180; lon < 180; lon += 30) {
    ctx.beginPath()
    let drawing = false
    for (let lat = -90; lat <= 90; lat += 2) {
      const p = project(lat, lon)
      if (!p.visible) { drawing = false; continue }
      if (drawing) ctx.lineTo(p.x, p.y)
      else { ctx.moveTo(p.x, p.y); drawing = true }
    }
    ctx.stroke()
  }

  for (const outline of CONTINENT_SILHOUETTES) {
    ctx.beginPath()
    let open = false
    for (let i = 0; i < outline.length; i++) {
      const [lon, lat] = outline[i]
      const p = project(lat, lon)
      if (!p.visible) { open = false; continue }
      if (!open) { ctx.moveTo(p.x, p.y); open = true }
      else ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.fillStyle = '#376d6c'
    ctx.fill()
    ctx.strokeStyle = 'rgba(178,220,173,.23)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  const atmospheric = ctx.createLinearGradient(50, 70, 475, 480)
  atmospheric.addColorStop(0, 'rgba(182,226,232,.23)')
  atmospheric.addColorStop(.32, 'rgba(92,157,177,.045)')
  atmospheric.addColorStop(1, 'rgba(0,0,0,.43)')
  ctx.fillStyle = atmospheric
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.restore()
  ctx.beginPath()
  ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(143,201,225,.64)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  for (const location of EXPLORER_LOCATIONS) {
    const point = project(location.latitude, location.longitude)
    if (!point.visible) continue
    const active = selectedId === location.id
    ctx.beginPath()
    ctx.arc(point.x, point.y, active ? 8 : 5, 0, 2 * Math.PI)
    ctx.fillStyle = active ? '#ffe1a3' : '#b5d7d6'
    ctx.shadowColor = active ? '#ffe0a3' : '#e5f4fc'
    ctx.shadowBlur = active ? 18 : 7
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#092334'
    ctx.lineWidth = 2
    ctx.stroke()
    if (active) {
      ctx.font = '600 13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffe2a7'
      ctx.fillText(location.name, point.x, point.y - 19)
    }
  }
}

export function EarthGlobe({ selected, onSelect, onEnterSky }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; latitude: number; longitude: number; moved: boolean } | null>(null)
  const [center, setCenter] = useState({ latitude: 28, longitude: -25 })
  const [zoom, setZoom] = useState(1)
  const [zooming, setZooming] = useState(false)

  useEffect(() => {
    if (!zooming) {
      setCenter({ latitude: selected.latitude, longitude: selected.longitude })
      setZoom(1)
    }
  }, [selected.latitude, selected.longitude, zooming])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) drawGlobe(ctx, center.latitude, center.longitude, selected.id)
  }, [center.latitude, center.longitude, selected.id])

  const pointerLocation = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) / box.width * SIZE, y: (event.clientY - box.top) / box.height * SIZE }
  }
  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const pos = pointerLocation(event)
    dragRef.current = { ...pos, ...center, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current
    if (!start) return
    const pos = pointerLocation(event)
    const dx = pos.x - start.x
    const dy = pos.y - start.y
    if (Math.abs(dx) + Math.abs(dy) > 5) start.moved = true
    if (start.moved) setCenter({
      latitude: clampLatitude(start.latitude + dy * .25),
      longitude: normalizedLongitude(start.longitude - dx * .35),
    })
  }
  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current
    dragRef.current = null
    if (!start || start.moved) return
    const pos = pointerLocation(event)
    for (const location of EXPLORER_LOCATIONS) {
      const p = orthographicProject(location.latitude, location.longitude, center.latitude, center.longitude)
      if (!p.visible) continue
      const x = CENTER + p.x * RADIUS
      const y = CENTER - p.y * RADIUS
      if (Math.hypot(pos.x - x, pos.y - y) < 22) {
        onSelect(location)
        enterSky()
        return
      }
    }
  }

  const enterSky = () => {
    if (zooming) return
    setZooming(true)
    setZoom(1.4)
    window.setTimeout(() => {
      onEnterSky()
      setZooming(false)
      setZoom(1)
    }, 820)
  }

  return (
    <div className="earth-globe-layout">
      <div className="earth-globe-field">
        <div className="earth-globe-zoom" style={{ transform: `scale(${zoom})` }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="earth-globe-canvas"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={() => { dragRef.current = null }}
            aria-label="Interactive globe. Drag to rotate, then click a highlighted city; or use the city buttons."
          />
        </div>
        <div className="globe-axis-label">EARTH / INTERACTIVE GLOBE</div>
        <div className="globe-drag-caption">Drag to rotate · Select a glowing marker</div>
      </div>
      <div className="earth-location-panel">
        <span className="sky-lab-eyebrow">01 / Select an observer</span>
        <h2>Every place has its own sky.</h2>
        <p>Rotate the globe or select a location. Where you stand on Earth changes which stars rise above your horizon.</p>
        <div className="globe-location-list" role="group" aria-label="Choose an observing location">
          {EXPLORER_LOCATIONS.map((location) => (
            <button key={location.id} type="button"
              aria-pressed={selected.id === location.id}
              className={selected.id === location.id ? 'is-selected' : ''}
              onClick={() => onSelect(location)}>
              <strong>{location.name}</strong>
              <span>{location.subtitle}</span>
            </button>
          ))}
        </div>
        <div className="globe-selected-note">
          <span>Selected observer</span>
          <strong>{selected.name}</strong>
          <small>{selected.latitude.toFixed(2)}° latitude · {selected.longitude.toFixed(2)}° longitude</small>
        </div>
        <button type="button" className="sky-lab-primary" onClick={enterSky} disabled={zooming}>
          {zooming ? 'Travelling to the observer…' : 'Travel down & view the sky'}
          <span aria-hidden="true">↗</span>
        </button>
        <p className="globe-footnote">Illustrative 3D globe silhouettes; city coordinates are geographic. The sky calculation uses the real coordinates, not the globe illustration.</p>
      </div>
    </div>
  )
}
