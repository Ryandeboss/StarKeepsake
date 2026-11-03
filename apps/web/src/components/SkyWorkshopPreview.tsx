import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from 'react'
import type { DesignSpec } from '../designSpec'
import { SkyOrientationMiniMap } from './SkyOrientationMiniMap'
import { SkyAtmosphereCanvas } from './SkyAtmosphereCanvas'
import { NAMED_STAR_COLORS, projectObserverStar, starAppearance, starTwinkleSettings } from '../skyImmersiveData'
import { starOptics } from '../skyPhotographicMath'
import { starDisplayName, starDescription, starCatalogUrl, getStarContext } from '../starDetails'
import { maskWorkingDimensions } from '../skyMaskMath'
import { photoFitStyle } from '../frameSkyBalance'
import type { AbovePhotoFitMode } from '../frameSkyBalance'
import { wrapWorkshopHeading, clampWorkshopPitch, observerPointInPanel } from '../skyWorkshopMath'
import './SkyWorkshopPreview.css'

type Props = {
  stars: DesignSpec['stars']
  photoUrl: string
  cutoutUrl: string
  layout: 'above' | 'within'
  imageAspect: number
  heading: number
  pitch: number
  fov: number
  skyHeight: number
  photoFit: AbovePhotoFitMode
  glow: boolean
  tone: 'natural' | 'indigo' | 'teal'
  maskAlpha?: Uint8ClampedArray | null
  maskDimensions?: { width: number; height: number } | null
  onHeading: (next: number) => void
  onPitch: (next: number) => void
}

const SKY_DIRECTION_PRESETS = [
  { label:'N', heading:0 }, { label:'E', heading:90 },
  { label:'S', heading:180 }, { label:'W', heading:270 },
] as const

export function SkyWorkshopPreview({
  stars, photoUrl, cutoutUrl, layout, imageAspect,
  heading, pitch, fov, skyHeight, photoFit, glow, tone, maskAlpha, maskDimensions,
  onHeading, onPitch,
}: Props) {
  const drag = useRef<{ x:number; y:number; heading:number; pitch:number } | null>(null)
  const [hoveredHip, setHoveredHip] = useState<number | null>(null)
  const [focusedHip, setFocusedHip] = useState<number | null>(null)
  const panelAspect = layout==='within'?imageAspect:imageAspect/(skyHeight/100)
  const visible = useMemo(() => stars.map(star => ({
    star,
    point:projectObserverStar(star.azimuthDeg, star.altitudeDeg, heading, pitch, fov),
    look:starAppearance(star),
    twinkle:starTwinkleSettings(star.hipparcosId, star.magnitude),
    optics:starOptics(star.magnitude,star.altitudeDeg,
      Boolean(NAMED_STAR_COLORS[star.hipparcosId]),glow),
  })).filter(item => {
    if(!item.point.inFront)return false
    const panel=observerPointInPanel(item.point.x,item.point.y,panelAspect)
    if(!panel.inside)return false
    if(layout!=='within'||!maskAlpha||!maskDimensions)return true
    const {width,height}=maskWorkingDimensions(maskDimensions.width,maskDimensions.height)
    if(maskAlpha.length!==width*height)return true
    const x=Math.max(0,Math.min(width-1,Math.floor(panel.x*width)))
    const y=Math.max(0,Math.min(height-1,Math.floor(panel.y*height)))
    return maskAlpha[y*width+x]<110
  }), [stars, heading, pitch, fov, glow,layout,panelAspect,maskAlpha,maskDimensions])
  const activeStar=visible.find(item=>item.star.hipparcosId===(hoveredHip??focusedHip))

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('[data-star-hit]')) return
    drag.current = { x:event.clientX,y:event.clientY,heading,pitch }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    onHeading(wrapWorkshopHeading(drag.current.heading - (event.clientX-drag.current.x)*.36))
    onPitch(clampWorkshopPitch(drag.current.pitch + (event.clientY-drag.current.y)*.24))
  }
  function stop() { drag.current = null }
  function onKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return
    event.preventDefault()
    if (event.key==='ArrowLeft') onHeading(wrapWorkshopHeading(heading-7))
    if (event.key==='ArrowRight') onHeading(wrapWorkshopHeading(heading+7))
    if (event.key==='ArrowUp') onPitch(clampWorkshopPitch(pitch+6))
    if (event.key==='ArrowDown') onPitch(clampWorkshopPitch(pitch-6))
  }

  // Restore the original Sky Lab's camera-relative photographic sky:
  // skyRgb paints atmosphere only; every star still comes from Hipparcos.
  const sky = <div className={`skw-star-atmosphere skw-tone-${tone}`}
    aria-label={`${visible.length} catalogue stars projected for your chosen direction`}>
    <SkyAtmosphereCanvas heading={heading} pitch={pitch} fov={fov} enhanced={glow}/>
    <div className="skw-color-grade" aria-hidden="true"/>
    <svg className="skw-catalog-stars" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"
      role="group" aria-label="Click a glowing star for its astronomical catalogue entry">
      {visible.map(({star,point,look,twinkle,optics})=>{
        const isMajor=look.named&&star.magnitude<1.5
        return <a key={star.hipparcosId} href={starCatalogUrl(star)}
          target="_blank" rel="noopener noreferrer" data-star-hit="true"
          aria-label={`Explore ${starDescription(star)} in the SIMBAD catalogue`}
          onPointerDown={event=>event.stopPropagation()}
          onMouseEnter={()=>setHoveredHip(star.hipparcosId)}
          onMouseLeave={()=>setHoveredHip(null)}
          onFocus={()=>setFocusedHip(star.hipparcosId)}
          onBlur={()=>setFocusedHip(null)}>
          <g className="skw-star-hit">
            <circle cx={point.x} cy={point.y} r={Math.max(16,optics.haloRadius)}
              fill="transparent"/>
            <g pointerEvents="none"
              className={isMajor?'skw-star-light skw-major':twinkle.animate?'skw-star-light skw-scintillate':'skw-star-light'}
              style={{
                animationDuration:`${twinkle.duration}s`,
                animationDelay:`${twinkle.delay}s`,
                '--twinkle-low':String(isMajor?Math.max(.86,twinkle.minimumOpacity-.055):twinkle.minimumOpacity),
              } as CSSProperties}>
              <defs>
                <radialGradient id={`skw-glow-${star.hipparcosId}`}>
                  <stop offset="0%" stopColor="#fffef9" stopOpacity={optics.haloOpacity*.92}/>
                  <stop offset="12%" stopColor={look.color} stopOpacity={optics.haloOpacity}/>
                  <stop offset="48%" stopColor={look.color} stopOpacity={optics.haloOpacity*.24}/>
                  <stop offset="100%" stopColor={look.color} stopOpacity="0"/>
                </radialGradient>
              </defs>
              <circle cx={point.x} cy={point.y} r={optics.haloRadius*(isMajor?1.16:1)}
                fill={`url(#skw-glow-${star.hipparcosId})`}/>
              <circle cx={point.x} cy={point.y} r={optics.coreRadius}
                fill={look.color} opacity={optics.coreOpacity}/>
              <circle cx={point.x} cy={point.y} r={Math.max(.3,optics.coreRadius*.34)}
                fill="#fffefa" opacity={optics.coreOpacity}/>
              {optics.spikes&&<g stroke={look.color} strokeWidth=".5" opacity=".17">
                <path d={`M ${point.x-optics.haloRadius} ${point.y} H ${point.x+optics.haloRadius}`}/>
                <path d={`M ${point.x} ${point.y-optics.haloRadius} V ${point.y+optics.haloRadius}`}/>
              </g>}
            </g>
            {isMajor&&<text x={point.x+13} y={point.y-12}
              className="skw-star-name" pointerEvents="none">{starDisplayName(star)}</text>}
            <title>{starDescription(star)}</title>
          </g>
        </a>
      })}
    </svg>
    {activeStar&&<div className="skw-star-detail" role="status">
      <strong>{starDisplayName(activeStar.star)}</strong>
      <span>{getStarContext(activeStar.star).summary}</span>
      <small>Magnitude {activeStar.star.magnitude.toFixed(2)} · {activeStar.star.altitudeDeg.toFixed(1)}° above the horizon</small>
      <span className="skw-star-open">Click the star to explore its SIMBAD catalogue entry ↗</span>
    </div>}
  </div>

  return <div className="skw-workshop">
    <div className="skw-topline">
      <span>YOUR NIGHT / LIVE FRAME</span>
      <span>LOOKING {Math.round(heading)}° · UP {Math.round(pitch)}°</span>
    </div>
    <div className="skw-frame-rail">
      <div className="skw-frame" style={{width:`min(100%, ${Math.max(220,Math.min(600,560*imageAspect))}px)`}}>
        <div className="skw-artwork" style={{aspectRatio:String(imageAspect)}}
          role="group" aria-label="Drag to choose which direction the sky faces"
          tabIndex={0} onPointerDown={start} onPointerMove={move}
          onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
          onKeyDown={onKeys}>
          {layout === 'within' ? <>
            {sky}
            <img className="skw-foreground" src={cutoutUrl || photoUrl}
              alt={cutoutUrl ? 'Your preserved foreground over the directed star field'
                : 'Your original photograph'} draggable={false}/>
            {!cutoutUrl && <span className="skw-unprepared">Edit the sky mask to reveal stars within your photograph</span>}
          </> : <>
            <div className="skw-sky-above" style={{height:`${skyHeight}%`}}>{sky}</div>
            <div className="skw-photo-below" style={{top:`${skyHeight}%`}}>
              <img src={photoUrl} alt="Your complete original photograph below its starry sky"
                style={photoFitStyle(photoFit)} draggable={false}/>
            </div>
          </>}
        </div>
      </div>
    </div>
    <div className="skw-footline">
      <span>✧ DRAG TO LOOK AROUND · HOVER FOR STAR NAMES · CLICK TO EXPLORE</span>
      <span>{visible.length} STARS IN VIEW</span>
    </div>
  </div>
}

export function SkyWorkshopOrientation({
  heading,pitch,fov,onHeading,onPitch,onFov,onReset,
}: {
  heading:number;pitch:number;fov:number;
  onHeading:(v:number)=>void;onPitch:(v:number)=>void;onFov:(v:number)=>void;onReset:()=>void
}) {
  return <div className="skw-orientation-controls">
    <div className="skw-dome-holder"><SkyOrientationMiniMap heading={heading} pitch={pitch} horizontalFov={fov}/></div>
    <p className="skw-orientation-copy">Choose the direction your photograph was facing. The gold window shows how much of the sky the frame is looking toward.</p>
    <fieldset className="skw-compass-buttons">
      <legend>Face a direction</legend>
      {SKY_DIRECTION_PRESETS.map(item => <button key={item.label}
        type="button" aria-pressed={Math.abs(heading-item.heading)<3}
        onClick={()=>onHeading(item.heading)}>{item.label}</button>)}
    </fieldset>
    <label className="skw-slider">Turn your view <strong>{Math.round(heading)}°</strong>
      <input type="range" min="0" max="359" step="1" value={heading}
        onChange={event=>onHeading(Number(event.target.value))}/></label>
    <label className="skw-slider">Look upward <strong>{Math.round(pitch)}°</strong>
      <input type="range" min="-8" max="88" step="1" value={pitch}
        onChange={event=>onPitch(Number(event.target.value))}/></label>
    <label className="skw-slider">Field of view <strong>{fov}°</strong>
      <input type="range" min="65" max="120" step="5" value={fov}
        onChange={event=>onFov(Number(event.target.value))}/></label>
    <button type="button" className="skw-reset" onClick={onReset}>↺ Reset perspective</button>
  </div>
}
