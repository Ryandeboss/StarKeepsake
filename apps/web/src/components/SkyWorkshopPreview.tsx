import { useMemo, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from 'react'
import type { DesignSpec } from '../designSpec'
import { SkyOrientationMiniMap } from './SkyOrientationMiniMap'
import { projectObserverStar, starAppearance, starTwinkleSettings } from '../skyImmersiveData'
import { photoFitStyle } from '../frameSkyBalance'
import type { AbovePhotoFitMode } from '../frameSkyBalance'
import { wrapWorkshopHeading, clampWorkshopPitch } from '../skyWorkshopMath'
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
  onHeading: (next: number) => void
  onPitch: (next: number) => void
}

export const SKY_DIRECTION_PRESETS = [
  { label:'N', heading:0 }, { label:'E', heading:90 },
  { label:'S', heading:180 }, { label:'W', heading:270 },
] as const

export function SkyWorkshopPreview({
  stars, photoUrl, cutoutUrl, layout, imageAspect,
  heading, pitch, fov, skyHeight, photoFit, onHeading, onPitch,
}: Props) {
  const drag = useRef<{ x:number; y:number; heading:number; pitch:number } | null>(null)
  const visible = useMemo(() => stars.map(star => ({
    star,
    point:projectObserverStar(star.azimuthDeg, star.altitudeDeg, heading, pitch, fov),
    look:starAppearance(star),
    twinkle:starTwinkleSettings(star.hipparcosId, star.magnitude),
  })).filter(item => item.point.inFront), [stars, heading, pitch, fov])

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
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

  const sky = <div className="skw-star-atmosphere" aria-label={`${visible.length} stars projected for your current perspective`}>
    <div className="skw-horizon-haze" aria-hidden="true"/>
    {visible.map(({star,point,look,twinkle}) => <i
      key={star.hipparcosId} className={twinkle.animate ? 'skw-point skw-twinkle' : 'skw-point'}
      data-hip={star.hipparcosId}
      title={`Hipparcos ${star.hipparcosId} · ${star.altitudeDeg.toFixed(1)}° altitude`}
      style={{
        left:`${point.x/10}%`, top:`${point.y/6}%`,
        width:Math.max(1.5,look.radius*1.7),height:Math.max(1.5,look.radius*1.7),
        backgroundColor:look.color,
        boxShadow:`0 0 ${Math.max(4,look.radius*4)}px ${look.color}`,
        animationDuration:`${twinkle.duration}s`,
        animationDelay:`${twinkle.delay}s`,
        opacity:Math.max(.35,1-star.magnitude*.115),
      }}/>)}
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
      <span>✧ DRAG TO LOOK AROUND · ARROW KEYS ALSO WORK</span>
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
