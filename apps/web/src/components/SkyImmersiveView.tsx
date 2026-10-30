import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { AstronomyResult } from '../api'
import {
  NAMED_STAR_COLORS, SKY_PATTERNS, projectObserverStar,
  starAppearance, suggestedObserverHeading,
} from '../skyImmersiveData'
import { getStarContext, starCatalogUrl, starCompassDirection, starDisplayName, starDescription } from '../starDetails'
import './SkyImmersiveView.css'

type Props = { result: AstronomyResult | null }
type SkyPoint = { x: number; y: number; inFront: boolean }
const wrapBearing = (value: number) => ((value % 360) + 360) % 360
const clampPitch = (value: number) => Math.max(-8, Math.min(88, value))

export function SkyImmersiveView({ result }: Props) {
  const [heading, setHeading] = useState(180)
  const [pitch, setPitch] = useState(24)
  const [fov, setFov] = useState(105)
  const [hoveredHip, setHoveredHip] = useState<number | null>(null)
  const [pinnedHip, setPinnedHip] = useState<number | null>(null)
  const [activePattern, setActivePattern] = useState<string | null>(null)
  const [showLines, setShowLines] = useState(true)
  const firstSky = useRef(false)
  const drag = useRef<{ x: number; y: number; heading: number; pitch: number; moved: boolean } | null>(null)

  useEffect(() => {
    if (!result || firstSky.current) return
    firstSky.current = true
    const face = result.stars
      .filter(star => NAMED_STAR_COLORS[star.hipparcosId])
      .sort((a, b) => a.magnitude - b.magnitude)[0]
    setHeading(suggestedObserverHeading(result.stars))
    setPitch(clampPitch(face?.altitudeDeg ?? 24))
  }, [result])

  const starByHip = useMemo(
    () => new Map(result?.stars.map(star => [star.hipparcosId, star]) ?? []),
    [result],
  )
  const visible = useMemo(() => result?.stars.map(star => ({
    star, point: projectObserverStar(star.azimuthDeg, star.altitudeDeg, heading, pitch, fov),
    appearance: starAppearance(star),
  })).filter(item => item.point.inFront) ?? [], [result, heading, pitch, fov])
  const pointsByHip = useMemo(() => new Map(visible.map(item => [item.star.hipparcosId, item.point])), [visible])
  const chosen = starByHip.get(hoveredHip ?? pinnedHip ?? -1)
  const chosenPoint = chosen ? pointsByHip.get(chosen.hipparcosId) : undefined
  const named = result?.stars.filter(star => NAMED_STAR_COLORS[star.hipparcosId])
    .sort((a, b) => a.magnitude - b.magnitude).slice(0, 12) ?? []

  const patterns = useMemo(() => SKY_PATTERNS.map(pattern => ({
    pattern,
    found: pattern.stars.filter(point => starByHip.has(point.hip)).length,
    framed: pattern.stars.filter(point => pointsByHip.has(point.hip)).length,
  })).sort((a, b) => b.found - a.found), [starByHip, pointsByHip])

  const horizon = Array.from({ length: 29 }, (_, i) => {
    const x = i / 28 * 1000
    const delta = Math.atan((x - 500) / 500 * Math.tan(fov * Math.PI / 360)) * 180 / Math.PI
    return projectObserverStar(heading + delta, 0, heading, pitch, fov).y
  })
  const groundPath = 'M 0 ' + horizon[0] +
    horizon.map((y, i) => ' L ' + (i / 28 * 1000) + ' ' + y).join('') +
    ' L 1000 600 L 0 600 Z'

  function facePattern(id: string) {
    const pattern = SKY_PATTERNS.find(item => item.id === id)
    if (!pattern) return
    const anchors = pattern.stars.map(point => starByHip.get(point.hip)).filter(star => star !== undefined)
    if (!anchors.length) return
    const radians = Math.PI / 180
    const x = anchors.reduce((total, star) => total + Math.sin(star.azimuthDeg * radians), 0)
    const y = anchors.reduce((total, star) => total + Math.cos(star.azimuthDeg * radians), 0)
    setHeading(wrapBearing(Math.atan2(x, y) / radians))
    setPitch(clampPitch(anchors.reduce((total, star) => total + star.altitudeDeg, 0) / anchors.length))
    setActivePattern(id)
    setPinnedHip(null)
  }
  function faceStar(id: number) {
    const star = starByHip.get(id)
    if (!star) return
    setHeading(wrapBearing(star.azimuthDeg))
    setPitch(clampPitch(star.altitudeDeg))
    setPinnedHip(id)
  }
  function startDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, heading, pitch, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function moveDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag.current) return
    const start = drag.current
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) + Math.abs(dy) < 4 && !start.moved) return
    start.moved = true
    setHeading(wrapBearing(start.heading - dx * 0.18))
    setPitch(clampPitch(start.pitch + dy * 0.15))
    setHoveredHip(null)
  }
  function endDrag() { drag.current = null }

  return (
    <div className="immersive-observatory">
      <div className="immersive-toolbar">
        <div>
          <span className="immersive-eyebrow">Live calculated observer's view</span>
          <strong>Look around the night sky</strong>
          <small>Drag to turn · Touch and swipe · Arrow keys to look around</small>
        </div>
        <label className="immersive-toggle">
          <input type="checkbox" checked={showLines} onChange={event => setShowLines(event.target.checked)}/>
          Show constellation guides
        </label>
      </div>
      <div className="immersive-sky-window" tabIndex={0}
        aria-label="First-person sky view. Use arrow keys to pan left, right, up or down."
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); setHeading(wrapBearing(heading - 10)) }
          if (event.key === 'ArrowRight') { event.preventDefault(); setHeading(wrapBearing(heading + 10)) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setPitch(clampPitch(pitch + 8)) }
          if (event.key === 'ArrowDown') { event.preventDefault(); setPitch(clampPitch(pitch - 8)) }
        }}>
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"
          role="img" aria-label="Perspective view of real calculated stars, with optional constellation guide lines"
          onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={endDrag} onPointerCancel={endDrag}>
          <defs>
            <linearGradient id="immersive-night" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#030915"/>
              <stop offset="68%" stopColor="#10243a"/>
              <stop offset="100%" stopColor="#214954"/>
            </linearGradient>
            <radialGradient id="immersive-atmosphere">
              <stop offset="0%" stopColor="#91a7b0" stopOpacity=".24"/>
              <stop offset="100%" stopColor="#91a7b0" stopOpacity="0"/>
            </radialGradient>
            <filter id="immersive-star-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="5"/>
            </filter>
          </defs>
          <rect width="1000" height="600" fill="url(#immersive-night)"/>
          <ellipse cx="500" cy="680" rx="800" ry="300" fill="url(#immersive-atmosphere)"/>
          {showLines && patterns.map(({ pattern }) => (
            <g key={pattern.id} className={activePattern === pattern.id ? 'is-featured' : ''}>
              {pattern.segments.map(([from, to]) => {
                const a = pointsByHip.get(from)
                const b = pointsByHip.get(to)
                if (!a || !b) return null
                return <line key={String(from) + '-' + String(to)} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className="immersive-constellation-line"
                  stroke={activePattern === pattern.id ? '#ffe4aa' : '#78bdd3'}
                  strokeWidth={activePattern === pattern.id ? 2.5 : 1.35}
                  strokeDasharray={pattern.kind === 'asterism' ? '6 5' : undefined}/>
              })}
              {activePattern === pattern.id && pattern.stars.map(point => {
                const projected = pointsByHip.get(point.hip)
                if (!projected) return null
                return <circle key={point.hip} cx={projected.x} cy={projected.y} r="12" className="immersive-pattern-marker"/>
              })}
            </g>
          ))}
          {visible.map(({ star, point, appearance }) => (
            <g key={star.hipparcosId} role="button" tabIndex={0}
              aria-label={starDescription(star)} aria-pressed={pinnedHip === star.hipparcosId}
              className="immersive-star" onPointerEnter={() => { if (!drag.current?.moved) setHoveredHip(star.hipparcosId) }}
              onPointerLeave={() => setHoveredHip(null)}
              onFocus={() => setHoveredHip(star.hipparcosId)}
              onBlur={() => setHoveredHip(null)}
              onClick={() => { if (!drag.current?.moved) setPinnedHip(current => current === star.hipparcosId ? null : star.hipparcosId) }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setPinnedHip(star.hipparcosId)
                }
              }}>
              <circle cx={point.x} cy={point.y} r={Math.max(13, appearance.radius + 7)} fill="transparent"/>
              <circle cx={point.x} cy={point.y} r={appearance.radius * 2.9}
                opacity={appearance.named ? .75 : .24} fill={appearance.color} filter="url(#immersive-star-glow)" pointerEvents="none"/>
              <circle cx={point.x} cy={point.y} r={appearance.radius} fill={appearance.color} pointerEvents="none"/>
              {(hoveredHip === star.hipparcosId || pinnedHip === star.hipparcosId) &&
                <circle cx={point.x} cy={point.y} r={appearance.radius + 7} fill="none" stroke="#ffe7b5" strokeWidth="1.5" pointerEvents="none"/>}
              {appearance.named && appearance.radius >= 3.5 &&
                <text x={point.x + 11} y={point.y - 12} className="immersive-star-label" pointerEvents="none">{starDisplayName(star)}</text>}
              <title>{starDescription(star)}</title>
            </g>
          ))}
          <path d={groundPath} fill="#061624" fillOpacity=".88" pointerEvents="none"/>
          <path d={groundPath.split(' L 1000 600')[0]} fill="none" stroke="#a6a7a0" strokeOpacity=".3" pointerEvents="none"/>
        </svg>
        <div className="immersive-crosshair" aria-hidden="true">+</div>
        <div className="immersive-view-readout">LOOK {Math.round(heading)}° · UP {Math.round(pitch)}° · FOV {fov}°</div>
        {chosen && chosenPoint && (
          <div className="immersive-star-tooltip" role="status">
            <strong>{starDisplayName(chosen)}</strong>
            <span>{starAppearance(chosen).category} · magnitude {chosen.magnitude.toFixed(2)}</span>
            <span>{starCompassDirection(chosen.azimuthDeg)} · {chosen.altitudeDeg.toFixed(0)}° above horizon</span>
            <small>HIP {chosen.hipparcosId} · click to pin and inspect</small>
          </div>
        )}
        {!result && <div className="immersive-waiting" role="status">Calculating this sky…</div>}
      </div>
      <div className="immersive-view-controls">
        <button type="button" onClick={() => setHeading(wrapBearing(heading - 18))}>← Turn left</button>
        <button type="button" onClick={() => setHeading(wrapBearing(heading + 18))}>Turn right →</button>
        <button type="button" onClick={() => setPitch(clampPitch(pitch + 12))}>↑ Look up</button>
        <button type="button" onClick={() => setPitch(clampPitch(pitch - 12))}>↓ Look down</button>
        <label>Field of view <input type="range" min="65" max="120" step="5" value={fov}
          onChange={event => setFov(Number(event.target.value))} aria-label="Sky field of view"/></label>
        <button type="button" onClick={() => { setHeading(180); setPitch(24); setFov(105); setActivePattern(null) }}>Reset view</button>
      </div>
      <div className="immersive-educational-note">
        <span className="immersive-legend-star immersive-blue"/> Hot blue-white
        <span className="immersive-legend-star immersive-white"/> White
        <span className="immersive-legend-star immersive-orange"/> Cooler orange-red
        <span className="immersive-legend-star immersive-neutral"/> Unclassified here
        <p>Color is shown for a curated group of identified stars; neutral white is used when our data has no verified color.
          Dot size follows apparent magnitude (brightness as seen from Earth), <strong>not physical star size</strong>.
          Lines are modern illustrative guides, not objects in space or official constellation boundaries.</p>
      </div>
      <div className="immersive-below">
        <div className="immersive-inspector">
          {chosen ? (
            <>
              <span className="immersive-eyebrow">Star inspector · HIP {chosen.hipparcosId}</span>
              <h3>{starDisplayName(chosen)}</h3>
              <p>{getStarContext(chosen).summary}</p>
              <div className="immersive-facts">
                <span>Magnitude <strong>{chosen.magnitude.toFixed(2)}</strong></span>
                <span>Altitude <strong>{chosen.altitudeDeg.toFixed(1)}°</strong></span>
                <span>Azimuth <strong>{chosen.azimuthDeg.toFixed(1)}°</strong></span>
              </div>
              <a href={starCatalogUrl(chosen)} target="_blank" rel="noopener noreferrer">Verify this HIP star in CDS SIMBAD ↗</a>
            </>
          ) : (
            <>
              <span className="immersive-eyebrow">Discover the stars</span>
              <h3>A sky you can explore.</h3>
              <p>Turn your view, hover over a glowing point, or select one of the named stars. Every plotted star has calculated coordinates for this place and moment.</p>
            </>
          )}
        </div>
        <div className="immersive-named-stars">
          <h3>Find a familiar star</h3>
          <div className="immersive-star-shortcuts">
            {named.map(star => (
              <button key={star.hipparcosId} type="button" onClick={() => faceStar(star.hipparcosId)}>
                <span style={{ color: starAppearance(star).color }}>✦</span> {starDisplayName(star)}
                <small>{star.magnitude.toFixed(1)} mag</small>
              </button>
            ))}
            {!named.length && <span>No highlighted stars in this current sample. Turn to explore the remaining Hipparcos stars.</span>}
          </div>
        </div>
      </div>
      <section className="immersive-patterns" aria-labelledby="immersive-patterns-heading">
        <div className="immersive-patterns-heading">
          <span className="immersive-eyebrow">Scroll down / Learn the patterns</span>
          <h2 id="immersive-patterns-heading">What are you looking at?</h2>
          <p>Connect the dots with simple sketches, then turn your view to the same stars in the calculated sky. Some patterns will be below the horizon, or only partly included in our selected bright-star sample.</p>
        </div>
        <div className="immersive-pattern-grid">
          {patterns.map(({ pattern, found }) => (
            <article className={activePattern === pattern.id ? 'immersive-pattern-card is-active' : 'immersive-pattern-card'} key={pattern.id}>
              <div className="immersive-card-caption">{pattern.kind === 'constellation' ? 'Constellation' : 'Asterism / familiar star pattern'}</div>
              <h3>{pattern.title}</h3>
              <div className="immersive-card-subtitle">{pattern.subtitle}</div>
              <svg className="immersive-pattern-sketch" viewBox="0 0 100 100" role="img"
                aria-label={pattern.title + ' approximate connection diagram, not to scale'}>
                {pattern.segments.map(([from, to]) => {
                  const a = pattern.stars.find(item => item.hip === from)
                  const b = pattern.stars.find(item => item.hip === to)
                  return a && b ? <line key={from + '-' + to} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c4d6ce" strokeWidth="1.3"/> : null
                })}
                {pattern.stars.map(star => <circle key={star.hip} cx={star.x} cy={star.y} r="2.6" fill="#ffe0a3"/>)}
              </svg>
              <p><strong>How to recognize it:</strong> {pattern.guide}</p>
              <p><strong>Story & meaning:</strong> {pattern.meaning}</p>
              <div className="immersive-card-footer">
                <span>{found} of {pattern.stars.length} guide stars in this calculated sample</span>
                <button type="button" disabled={found === 0} onClick={() => facePattern(pattern.id)}>
                  {found ? 'Find in my sky ↗' : 'Not in this sample'}
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="immersive-pattern-source">
          Reference reading:
          <a href="https://science.nasa.gov/skywatching/faq/" target="_blank" rel="noopener noreferrer">NASA · Constellations vs. asterisms</a>
          <a href="https://science.nasa.gov/exoplanets/stars/" target="_blank" rel="noopener noreferrer">NASA · Why stars have different colors</a>
          <a href="https://skyserver.sdss.org/dr14/en/proj/kids/constellation/orionstars.aspx" target="_blank" rel="noopener noreferrer">SDSS · Orion</a>
        </p>
      </section>
    </div>
  )
}
