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
import { photoFitStyle, skyAboveArtworkAspect } from '../frameSkyBalance'
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
  showPerspectiveGuide: boolean
  showroom: boolean
  lightsOn: boolean
  finish: 'walnut'|'oak'|'ebony'
  onPerspectiveInteract: () => void
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
  showPerspectiveGuide, showroom, lightsOn, finish,
  onPerspectiveInteract, onHeading, onPitch,
}: Props) {
  const [tilt,setTilt]=useState({x:0,y:0})
  const drag = useRef<{ x:number; y:number; heading:number; pitch:number } | null>(null)
  const [hoveredHip, setHoveredHip] = useState<number | null>(null)
  const [focusedHip, setFocusedHip] = useState<number | null>(null)
  const artworkAspect=layout==='above'?skyAboveArtworkAspect(imageAspect,skyHeight):imageAspect
  // The separate sky and the photo span the same full panel width.
  // Their panel aspect ratios are derived from the same composite frame.
  const panelAspect=layout==='within'?artworkAspect:artworkAspect/(skyHeight/100)
  const visible = useMemo(() => stars.map(star => ({
    star,
    point:projectObserverStar(star.azimuthDeg, star.altitudeDeg, heading, pitch, fov),
    look:starAppearance(star),
    twinkle:starTwinkleSettings(star.hipparcosId, star.magnitude),
    optics:starOptics(star.magnitude,star.altitudeDeg,
      Boolean(NAMED_STAR_COLORS[star.hipparcosId]),true),
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
  }), [stars, heading, pitch, fov,layout,panelAspect,maskAlpha,maskDimensions])
  const activeStar=visible.find(item=>item.star.hipparcosId===(hoveredHip??focusedHip))

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (showroom || event.button !== 0 || (event.target as Element).closest('[data-star-hit]')) return
    onPerspectiveInteract()
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
    if (showroom || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return
    event.preventDefault()
    onPerspectiveInteract()
    if (event.key==='ArrowLeft') onHeading(wrapWorkshopHeading(heading-7))
    if (event.key==='ArrowRight') onHeading(wrapWorkshopHeading(heading+7))
    if (event.key==='ArrowUp') onPitch(clampWorkshopPitch(pitch+6))
    if (event.key==='ArrowDown') onPitch(clampWorkshopPitch(pitch-6))
  }

  // Restore the original Sky Lab's camera-relative photographic sky:
  // skyRgb paints atmosphere only; every star still comes from Hipparcos.
  const sky = <div className={`skw-star-atmosphere skw-tone-${tone}`}
    aria-label={`${visible.length} catalogue stars projected for your chosen direction`}>
    <SkyAtmosphereCanvas heading={heading} pitch={pitch} fov={fov} enhanced={true} horizonGlow={glow}/>
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
  </div>

  return <div className={`skw-workshop ${showroom?'skw-showroom':''} ${lightsOn?'skw-lights-on':'skw-lights-off'} skw-finish-${finish}`}>
    <div className="skw-topline">
      <span>YOUR NIGHT / LIVE FRAME</span>
      <span>LOOKING {Math.round(heading)}° · UP {Math.round(pitch)}°</span>
    </div>
    <div className="skw-frame-rail"
      onPointerMove={event=>{
        if(!showroom||event.pointerType==='touch')return
        const rect=event.currentTarget.getBoundingClientRect()
        const dx=(event.clientX-rect.left)/rect.width-.5
        const dy=(event.clientY-rect.top)/rect.height-.5
        setTilt({x:-dy*12,y:dx*17})
      }}
      onPointerLeave={()=>setTilt({x:0,y:0})}
      style={{'--skw-tilt-x':`${tilt.x.toFixed(2)}deg`,
        '--skw-tilt-y':`${tilt.y.toFixed(2)}deg`} as CSSProperties}>
      <div className="skw-frame" style={{
        width:`min(100%, ${Math.max(155,Math.min(600,560*artworkAspect))}px, calc(80vh * ${artworkAspect}))`
      }}>
        <div className="skw-artwork" style={{aspectRatio:String(artworkAspect)}}
          role="group"
          aria-label={showroom?'Framed keepsake display in a simulated room':'Drag to choose which direction the sky faces'}
          tabIndex={showroom?-1:0} onPointerDown={start} onPointerMove={move}
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
          {showPerspectiveGuide && !showroom && <div className="skw-gesture-guide" aria-hidden="true">
            <div className="skw-gesture-track"/>
            <div className="skw-gesture-cursor">
              <svg width="31" height="38" viewBox="0 0 32 39" aria-hidden="true">
                <path d="M5 2v24l6.4-5.5 5.2 13.7 6.6-3.1-5.4-12.9 9.6.6Z"
                  fill="#fff6dc" stroke="#092638" strokeWidth="1.9"
                  strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="skw-gesture-caption">
              <strong>Find your view of the night</strong>
              <span>Drag left, right, up or down to explore the sky.</span>
              <span>Or choose N / E / S / W on the compass.</span>
            </div>
          </div>}
        </div>
      </div>
      {activeStar&&<div className={`skw-star-detail ${layout==='above'?'skw-star-detail--compact':''}`}
        role="status" aria-live="polite">
        <strong>{starDisplayName(activeStar.star)}</strong>
        <span>{getStarContext(activeStar.star).summary}</span>
        <small>Magnitude {activeStar.star.magnitude.toFixed(2)} · Altitude {activeStar.star.altitudeDeg.toFixed(1)}°</small>
        <span className="skw-star-open">Select the star to open its astronomical catalogue entry ↗</span>
      </div>}
    </div>
    <div className="skw-footline">
      <span>{showroom?'✧ DIMENSIONAL PRODUCT MOCKUP · MOVE TO INSPECT':'✧ DRAG TO LOOK AROUND · HOVER FOR STAR NAMES · CLICK TO EXPLORE'}</span>
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
