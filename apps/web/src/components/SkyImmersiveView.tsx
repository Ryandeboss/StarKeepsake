import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { AstronomyResult } from '../api'
import type { ExplorerLocation } from '../skyExplorerData'
import { SkyCityHorizon } from './SkyCityHorizon'
import { SkyCutoutPreview } from './SkyCutoutPreview'
import { getObserverScene } from '../skyLandscapeData'
import { SkyStreetView } from './SkyStreetView'
import { SkyOrientationMiniMap } from './SkyOrientationMiniMap'
import { SkyAtmosphereCanvas } from './SkyAtmosphereCanvas'
import { starOptics } from '../skyPhotographicMath'
import { photoHorizonBottomPercent } from '../skyAtmosphereMath'
import { fitAbovePhotoLayout } from '../photoSkyLayout'
import {
  NAMED_STAR_COLORS, SKY_PATTERNS, projectObserverStar,
  starAppearance, starTwinkleSettings, suggestedObserverHeading,
} from '../skyImmersiveData'
import { getStarContext, starCatalogUrl, starCompassDirection, starDisplayName, starDescription } from '../starDetails'
import './SkyImmersiveView.css'

type Props = { result: AstronomyResult | null; location: ExplorerLocation }
const wrapBearing = (value: number) => ((value % 360) + 360) % 360
const clampPitch = (value: number) => Math.max(-8, Math.min(88, value))

export function SkyImmersiveView({ result, location }: Props) {
  const [heading, setHeading] = useState(() => suggestedObserverHeading(result?.stars ?? []))
  const [pitch, setPitch] = useState(15)
  const [fov, setFov] = useState(105)
  const [hoveredHip, setHoveredHip] = useState<number | null>(null)
  const [pinnedHip, setPinnedHip] = useState<number | null>(null)
  const [activePattern, setActivePattern] = useState<string | null>(null)
  const [showLines, setShowLines] = useState(true)
  const [photoExposure, setPhotoExposure] = useState(true)
  const [showScenery, setShowScenery] = useState(true)
  const [photoMode, setPhotoMode] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoSkyLayout, setPhotoSkyLayout] = useState<'within' | 'above'>('within')
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null)
  const [originalPhotoSize, setOriginalPhotoSize] = useState({ width: 0, height: 0 })
  const [skyWindowSize, setSkyWindowSize] = useState({ width: 0, height: 0 })
  const [photoError, setPhotoError] = useState('')
  const [photoScale, setPhotoScale] = useState(100)
  const [editingPhoto, setEditingPhoto] = useState<File | null>(null)
  const [cutoutEditorOpen, setCutoutEditorOpen] = useState(false)
  const [cutoutSession, setCutoutSession] = useState(0)
  const photoUpload = useRef<HTMLInputElement | null>(null)
  const imageObjectUrl = useRef<string | null>(null)
  const originalObjectUrl = useRef<string | null>(null)
  const decodeId = useRef(0)
  useEffect(() => () => {
    if (imageObjectUrl.current) URL.revokeObjectURL(imageObjectUrl.current)
    if (originalObjectUrl.current) URL.revokeObjectURL(originalObjectUrl.current)
    decodeId.current += 1
  }, [])
  const [groundView, setGroundView] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [demoRun, setDemoRun] = useState(0)
  const [touring, setTouring] = useState(false)
  const skyWindowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const target = skyWindowRef.current
    if (!target) return
    const update = () => {
      const bounds = target.getBoundingClientRect()
      setSkyWindowSize({ width: bounds.width, height: bounds.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
  const drag = useRef<{ x: number; y: number; heading: number; pitch: number; moved: boolean } | null>(null)
  const ignoreClick = useRef(false)
  const tourCamera = useRef({ heading: suggestedObserverHeading(result?.stars ?? []), pitch: 15 })
  const tourFrame = useRef<number | null>(null)
  const introTimer = useRef<number | null>(null)

  // Show the camera freedom without requiring users to discover a hidden gesture.
  // This is only a client-side camera tour: astronomy positions stay untouched.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    introTimer.current = window.setTimeout(() => {
      introTimer.current = null
      setDemoRun(1)
    }, 700)
    return () => {
      if (introTimer.current !== null) window.clearTimeout(introTimer.current)
      introTimer.current = null
    }
  }, [])

  useEffect(() => {
    if (!demoRun) return
    const base = tourCamera.current
    let begun = 0
    let announced = false
    const tick = (now: number) => {
      if (!announced) { setTouring(true); announced = true }
      if (!begun) begun = now
      const t = Math.min(1, (now - begun) / 3600)
      // Oscillate to demonstrate both directions, then return to the start.
      setHeading(wrapBearing(base.heading + Math.sin(t * Math.PI * 2) * 28))
      setPitch(clampPitch(base.pitch + Math.sin(t * Math.PI) * 5))
      if (t < 1) {
        tourFrame.current = window.requestAnimationFrame(tick)
      } else {
        tourFrame.current = null
        setTouring(false)
        setHeading(base.heading)
        setPitch(base.pitch)
      }
    }
    tourFrame.current = window.requestAnimationFrame(tick)
    return () => {
      if (tourFrame.current !== null) window.cancelAnimationFrame(tourFrame.current)
      tourFrame.current = null
    }
  }, [demoRun])

  function interruptTour() {
    if (introTimer.current !== null) window.clearTimeout(introTimer.current)
    introTimer.current = null
    if (tourFrame.current !== null) window.cancelAnimationFrame(tourFrame.current)
    tourFrame.current = null
    setTouring(false)
    setShowHint(false)
  }
  function replayTour() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShowHint(true)
      return
    }
    if (tourFrame.current !== null) window.cancelAnimationFrame(tourFrame.current)
    tourCamera.current = { heading, pitch }
    setShowHint(true)
    setDemoRun(run => run + 1)
  }
  function receivePhoto(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/webp', 'image/png'].includes(file.type) || file.size > 12000000) {
      setPhotoError('Choose a JPG, PNG, or WebP image under 12 MB.')
      return
    }
    setPhotoError('')
    interruptTour()
    // A new upload starts a new composition, never displaying a stale cutout.
    if (imageObjectUrl.current) URL.revokeObjectURL(imageObjectUrl.current)
    imageObjectUrl.current = null
    setPhotoUrl(null)
    setPhotoScale(100)
    const originalUrl = URL.createObjectURL(file)
    if (originalObjectUrl.current) URL.revokeObjectURL(originalObjectUrl.current)
    originalObjectUrl.current = originalUrl
    setOriginalPhotoUrl(originalUrl)
    setOriginalPhotoSize({ width: 0, height: 0 })
    const currentId = ++decodeId.current
    void createImageBitmap(file).then(image => {
      if (currentId === decodeId.current)
        setOriginalPhotoSize({ width: image.width, height: image.height })
      image.close()
    }).catch(() => {
      if (currentId === decodeId.current)
        setPhotoError('The photo dimensions could not be read.')
    })
    setEditingPhoto(file)
    setCutoutSession(version => version + 1)
    if (photoSkyLayout === 'within') {
      setPhotoMode(false)
      setCutoutEditorOpen(true)
    } else {
      // The separate-sky option never needs segmentation or another upload.
      setPhotoMode(true)
      setCutoutEditorOpen(false)
    }
  }
  function applyPhotoCutout(cutout: Blob) {
    const url = URL.createObjectURL(cutout)
    if (imageObjectUrl.current) URL.revokeObjectURL(imageObjectUrl.current)
    imageObjectUrl.current = url
    setPhotoUrl(url)
    setPhotoMode(true)
    setGroundView(false)
    setPhotoSkyLayout('within')
    // Keep the source photo and SkyCutoutPreview mounted after applying.
    // Returning to the editor preserves the Fal mask and all local edits.
    setCutoutEditorOpen(false)
  }
  function nudge(dx: number, dy: number) {
    interruptTour()
    setHeading(current => wrapBearing(current + dx))
    setPitch(current => clampPitch(current + dy))
  }

  const starByHip = useMemo(
    () => new Map<number, AstronomyResult['stars'][number]>(result?.stars.map(star => [star.hipparcosId, star] as const) ?? []),
    [result],
  )
  const visible = useMemo(() => result?.stars.map(star => ({
    star, point: projectObserverStar(star.azimuthDeg, star.altitudeDeg, heading, pitch, fov),
    appearance: starAppearance(star),
    twinkle: starTwinkleSettings(star.hipparcosId, star.magnitude),
    optics: starOptics(star.magnitude, star.altitudeDeg, Boolean(NAMED_STAR_COLORS[star.hipparcosId]), photoExposure),
  })).filter(item => item.point.inFront) ?? [], [result, heading, pitch, fov, photoExposure])
  const photoBottom = photoHorizonBottomPercent(pitch, fov)
  const abovePhotoFrame = fitAbovePhotoLayout(
    skyWindowSize.width, skyWindowSize.height,
    originalPhotoSize.width, originalPhotoSize.height,
  )
  const isAbovePhoto = photoSkyLayout === 'above'
  const pointsByHip = useMemo(() => new Map(visible.map(item => [item.star.hipparcosId, item.point] as const)), [visible])
  const chosen = starByHip.get(hoveredHip ?? pinnedHip ?? -1)
  const chosenPoint = chosen ? pointsByHip.get(chosen.hipparcosId) : undefined
  const named = result?.stars.filter(star => NAMED_STAR_COLORS[star.hipparcosId])
    .sort((a, b) => a.magnitude - b.magnitude).slice(0, 12) ?? []

  const patterns = useMemo(() => SKY_PATTERNS.map(pattern => ({
    pattern,
    found: pattern.stars.filter(point => starByHip.has(point.hip)).length,
    framed: pattern.stars.filter(point => pointsByHip.has(point.hip)).length,
  })).sort((a, b) => b.found - a.found), [starByHip, pointsByHip])

  function facePattern(id: string) {
    interruptTour()
    setGroundView(false)
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
    skyWindowRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'center',
    })
  }
  function faceStar(id: number) {
    interruptTour()
    setGroundView(false)
    const star = starByHip.get(id)
    if (!star) return
    setHeading(wrapBearing(star.azimuthDeg))
    setPitch(clampPitch(star.altitudeDeg))
    setPinnedHip(id)
  }
  function startDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    interruptTour()
    ignoreClick.current = false
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
  function endDrag() {
    if (drag.current?.moved) {
      ignoreClick.current = true
      window.setTimeout(() => { ignoreClick.current = false }, 0)
    }
    drag.current = null
  }

  return (
    <div className="immersive-observatory">
      <div className="immersive-toolbar">
        <div>
          <span className="immersive-eyebrow">Live calculated observer's view</span>
          <strong>Look around the night sky</strong>
          <small>Drag or swipe to explore · Keyboard arrows also work</small>
        </div>
        <div className="immersive-toolbar-options">
          <div className="immersive-view-tabs" role="group" aria-label="Choose sky or street-level scenery">
            <button type="button" aria-pressed={!groundView && !photoMode} className={!groundView && !photoMode ? 'is-selected' : ''}
              onClick={() => { setGroundView(false); setPhotoMode(false) }}>✦ Calculated night sky</button>
            <button type="button" aria-pressed={groundView} className={groundView ? 'is-selected' : ''}
              onClick={() => { interruptTour(); setGroundView(true) }}>◉ Real Street View</button>
            <button type="button" aria-pressed={!groundView && photoMode}
              disabled={location.id !== 'chicago'}
              title={location.id !== 'chicago' ? 'The photographic prototype is available for Chicago only' : undefined}
              className={!groundView && photoMode ? 'is-selected' : ''}
              onClick={() => {
                if (location.id !== 'chicago') return
                if (!photoUrl && !originalPhotoUrl) photoUpload.current?.click()
                else { interruptTour(); setGroundView(false); setPhotoMode(true) }
              }}>◈ Chicago skyline photo</button>
          </div>
          {!groundView && <label className="immersive-toggle">
            <input type="checkbox" checked={photoExposure} onChange={event => setPhotoExposure(event.target.checked)}/>
            Photographic sky
          </label>}
          {!groundView && <label className="immersive-toggle">
            <input type="checkbox" checked={showLines} onChange={event => setShowLines(event.target.checked)}/>
            Constellations
          </label>}
          {!groundView && !photoMode && <label className="immersive-toggle">
            <input type="checkbox" checked={showScenery} onChange={event => setShowScenery(event.target.checked)}/>
            City scenery
          </label>}
          {!groundView && <button type="button" className="immersive-replay-button" onClick={replayTour}>
            ↻ Show me how to look around
          </button>}
        </div>
      </div>
      {location.id === 'chicago' && !groundView && <div className="immersive-photo-setup">
        <fieldset className="immersive-photo-layout-choices">
          <legend>Where should the stars go?</legend>
          <button type="button" className={photoSkyLayout === 'within' ? 'is-chosen' : ''}
            aria-pressed={photoSkyLayout === 'within'}
            onClick={() => {
              setPhotoSkyLayout('within')
              if (editingPhoto && !photoUrl) { setCutoutEditorOpen(true); setPhotoMode(false) }
              else if (photoUrl) { setCutoutEditorOpen(false); setPhotoMode(true) }
            }}>
            <span className="immersive-layout-thumbnail is-within" aria-hidden="true">
              <span className="immersive-layout-stars">✧ ✦ ·</span>
              <span className="immersive-layout-land"/>
            </span>
            <span><strong>Within my photo</strong>
              <small>My image already has a sky or horizon. Keep foreground detail and replace its sky.</small></span>
          </button>
          <button type="button" className={isAbovePhoto ? 'is-chosen' : ''}
            aria-pressed={isAbovePhoto}
            onClick={() => {
              setPhotoSkyLayout('above')
              setCutoutEditorOpen(false)
              if (originalPhotoUrl) { setPhotoMode(true); setGroundView(false) }
            }}>
            <span className="immersive-layout-thumbnail is-above" aria-hidden="true">
              <span className="immersive-layout-stars">✧ ✦ ·</span>
              <span className="immersive-layout-boundary"/>
              <span className="immersive-layout-land"/>
            </span>
            <span><strong>Above my photo</strong>
              <small>No visible horizon? Add a new starry sky section above the entire original image.</small></span>
          </button>
        </fieldset>
        <label>
          <span>Choose your photo · JPG, PNG or WebP</span>
          <input ref={photoUpload} type="file" accept="image/jpeg,image/webp,image/png"
            onChange={event => {
              receivePhoto(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}/>
        </label>
        {editingPhoto && !isAbovePhoto && <button type="button" className="immersive-edit-cutout"
          onClick={() => {
            interruptTour()
            setGroundView(false)
            if (photoUrl) setPhotoMode(true)
            setCutoutEditorOpen(true)
          }}>{photoUrl ? '✎ Edit cutout' : 'Prepare sky cutout'}</button>}
        {(isAbovePhoto ? originalPhotoUrl : photoUrl) && <>
          <button type="button" aria-pressed={photoMode}
            onClick={() => { interruptTour(); setPhotoMode(mode => !mode) }}>
            {photoMode ? 'Hide skyline' : 'Show skyline'}
          </button>
          {photoMode && !isAbovePhoto && <label>Skyline size <strong>{photoScale}%</strong>
            <input type="range" min="100" max="160" step="5" value={photoScale}
              onChange={event => setPhotoScale(Number(event.target.value))}/>
          </label>}
        </>}
        {photoError && <span role="alert" className="immersive-photo-error">{photoError}</span>}
        <small>{isAbovePhoto
          ? 'This layout keeps the entire photo intact, then adds a distinct calculated star-sky area above it. No AI sky removal is required.'
          : 'This is the original sky-cutout layout: remove the existing sky, preserve your foreground and horizon, and edit the cutout again after applying.'}
          Stars are calculated for the selected moment, but are not calibrated to the photo camera.</small>
      </div>}
      {editingPhoto && <div hidden={!cutoutEditorOpen}>
        <SkyCutoutPreview key={cutoutSession} file={editingPhoto} active={cutoutEditorOpen}
          onApply={applyPhotoCutout} onCancel={() => setCutoutEditorOpen(false)}/>
      </div>}
      <div ref={skyWindowRef} className="immersive-sky-window" tabIndex={groundView ? -1 : 0}
        aria-label="First-person sky view. Use arrow keys to pan left, right, up or down."
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-10, 0) }
          if (event.key === 'ArrowRight') { event.preventDefault(); nudge(10, 0) }
          if (event.key === 'ArrowUp') { event.preventDefault(); nudge(0, 8) }
          if (event.key === 'ArrowDown') { event.preventDefault(); nudge(0, -8) }
        }}>
        {groundView
          ? <SkyStreetView location={location} camera={{ heading, pitch }}
              onCameraChange={(camera) => { setHeading(wrapBearing(camera.heading)); setPitch(clampPitch(camera.pitch)) }}/>
          : <>
        <SkyAtmosphereCanvas heading={heading} pitch={pitch} fov={fov} enhanced={photoExposure}/>
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"
          role="img" aria-label="Perspective view of real calculated stars, with optional constellation guide lines"
          onPointerDown={startDrag} onPointerMove={moveDrag}
          onPointerUp={endDrag} onPointerCancel={endDrag}>
          <defs>
          </defs>
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
          {visible.map(({ star, point, appearance, twinkle, optics }) => (
            <g key={star.hipparcosId} role="button" tabIndex={0}
              aria-label={starDescription(star)} aria-pressed={pinnedHip === star.hipparcosId}
              className="immersive-star"
              onPointerEnter={() => { if (!drag.current?.moved) setHoveredHip(star.hipparcosId) }}
              onPointerLeave={() => setHoveredHip(null)}
              onFocus={() => setHoveredHip(star.hipparcosId)}
              onBlur={() => setHoveredHip(null)}
              onClick={() => { if (!ignoreClick.current) setPinnedHip(current => current === star.hipparcosId ? null : star.hipparcosId) }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setPinnedHip(star.hipparcosId)
                }
              }}>
              <circle cx={point.x} cy={point.y} r={Math.max(12, appearance.radius + 8)}
                fill="transparent"/>
              <g className={twinkle.animate ? 'immersive-star-light can-twinkle' : 'immersive-star-light'}
                style={{ animationDuration: twinkle.duration + 's', animationDelay: twinkle.delay + 's',
                  '--twinkle-low': String(twinkle.minimumOpacity) } as CSSProperties}
                pointerEvents="none">
                <defs>
                  <radialGradient id={`immersive-psf-${star.hipparcosId}`}>
                    <stop offset="0%" stopColor="#fffdfa" stopOpacity={optics.haloOpacity * .96}/>
                    <stop offset="13%" stopColor={appearance.color} stopOpacity={optics.haloOpacity}/>
                    <stop offset="48%" stopColor={appearance.color} stopOpacity={optics.haloOpacity * .23}/>
                    <stop offset="100%" stopColor={appearance.color} stopOpacity="0"/>
                  </radialGradient>
                </defs>
                <circle cx={point.x} cy={point.y} r={optics.haloRadius}
                  fill={`url(#immersive-psf-${star.hipparcosId})`}/>
                <circle cx={point.x} cy={point.y} r={optics.coreRadius}
                  fill={appearance.color} opacity={optics.coreOpacity}/>
                <circle cx={point.x} cy={point.y} r={Math.max(.25, optics.coreRadius * .36)}
                  fill="#fffcf6" opacity={optics.coreOpacity}/>
                {optics.spikes && <g stroke={appearance.color} strokeWidth=".42" opacity=".18">
                  <path d={`M ${point.x - optics.haloRadius*.77} ${point.y} H ${point.x + optics.haloRadius*.77}`}/>
                  <path d={`M ${point.x} ${point.y - optics.haloRadius*.77} V ${point.y + optics.haloRadius*.77}`}/>
                </g>}
              </g>
              {(hoveredHip === star.hipparcosId || pinnedHip === star.hipparcosId) &&
                <circle cx={point.x} cy={point.y} r={appearance.radius + 7}
                  fill="none" stroke="#ffe7b5" strokeWidth="1.2" pointerEvents="none"/>}
              {appearance.named && star.magnitude < 1.35 &&
                <text x={point.x + 10} y={point.y - 10} className="immersive-star-label"
                  pointerEvents="none">{starDisplayName(star)}</text>}
              <title>{starDescription(star)}</title>
            </g>
          ))}
          {showScenery && !photoMode && <SkyCityHorizon location={location} heading={heading} pitch={pitch} fov={fov}/>}
          {!showScenery && !photoMode && <path
            d={`M0 ${projectObserverStar(heading, 0, heading, pitch, fov).y} H1000 V600 H0Z`}
            fill="#061624" pointerEvents="none"/>}
        </svg>
        {photoMode && !isAbovePhoto && photoUrl && <img
          src={photoUrl} alt="" aria-hidden="true"
          className="immersive-photo-horizon"
          style={{ width: photoScale + '%', bottom: photoBottom + '%' }}/>}
        {photoMode && isAbovePhoto && originalPhotoUrl && abovePhotoFrame.width > 0 &&
          <div className="immersive-sky-above-frame"
            aria-label="Separate star-sky section above the entire original photo"
            style={{ width: abovePhotoFrame.width, height: abovePhotoFrame.height }}>
            <div className="immersive-sky-above-panel"
              style={{ height: abovePhotoFrame.skyHeight }} aria-hidden="true"/>
            <img src={originalPhotoUrl} alt="Original photograph beneath a separate star-sky section"
              className="immersive-sky-above-original" draggable={false}
              style={{ height: abovePhotoFrame.photoHeight }}/>
          </div>}
        
        <SkyOrientationMiniMap heading={heading} pitch={pitch} horizontalFov={fov}/>
        <div className="immersive-crosshair" aria-hidden="true">+</div>
        {showHint && <div className="immersive-look-hint" role="status">
          <span className="immersive-look-hint-eyebrow">{touring ? 'Watch the camera turn' : 'YOUR VIEW IS INTERACTIVE'}</span>
          <strong>Drag to look around</strong>
          <span>Swipe or drag across the sky; you can also use the keyboard.</span>
          <button type="button" onClick={() => { interruptTour(); skyWindowRef.current?.focus() }}>Got it</button>
        </div>}
        <div className="immersive-location-readout">
          <strong>{location.name}</strong>
          <small>{photoMode
            ? isAbovePhoto ? 'Separate sky above full photo · original image unchanged'
              : 'Existing horizon and transparent foreground · not a 360° panorama'
            : getObserverScene(location.id).title + ' · illustrative scenery, not an exact sightline'}</small>
        </div>
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
          </>}
      </div>
      {!groundView && <div className="immersive-view-controls">
        {!photoMode && <label>Field of view <input type="range" min="65" max="120" step="5" value={fov}
          onChange={event => { interruptTour(); setFov(Number(event.target.value)) }} aria-label="Sky field of view"/></label>}
        <button type="button" onClick={() => { interruptTour(); setHeading(suggestedObserverHeading(result?.stars ?? [])); setPitch(15); setFov(105); setActivePattern(null) }}>Reset view</button>
      </div>}
      {groundView && <div className="immersive-ground-message">Google's real panoramas are captured at a different time from your selected sky date. The camera's heading and pitch carry back into the star view, but building occlusion and the panorama's zoom are not calibrated as a historical night reconstruction.</div>}
      <div className="immersive-educational-note">
        <span className="immersive-legend-star immersive-blue"/> Hot blue-white
        <span className="immersive-legend-star immersive-white"/> White
        <span className="immersive-legend-star immersive-orange"/> Cooler orange-red
        <span className="immersive-legend-star immersive-neutral"/> Unclassified here
        <p>Color is shown for a curated group of identified stars; neutral white is used when our data has no verified color.
          Photographic brightness and bloom follow apparent magnitude (brightness as seen from Earth), <strong>not physical star size</strong>. Subtle scintillation and atmospheric city glow are artistic effects, not a reconstruction of historical light pollution or weather.
          Lines are modern illustrative guides, not objects in space or official constellation boundaries.
          {photoMode ? ' This AI skyline has no verified compass bearing. The 2D plate follows vertical camera pitch as a visual approximation, but cannot reproduce genuine 3D or 360° parallax.' :
            ' The local skylines are original, geographically inspired artwork, not photographs or landmark-accurate bearings.'}</p>
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
