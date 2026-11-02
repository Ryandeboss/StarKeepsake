import { domeAltitudeY, domeWindow } from '../skyDomeMath'
import './SkyOrientationMiniMap.css'

type Props = { heading: number; pitch: number; horizontalFov: number }

/**
 * Unwrapped 360° sky dome, with a live viewport rectangle. Both horizontal
 * and vertical limits follow the actual observer camera. It intentionally
 * doesn't claim that a flat Chicago photograph covers all 360°.
 */
export function SkyOrientationMiniMap({ heading, pitch, horizontalFov }: Props) {
  const area = { x: 19, y: 30, w: 240, h: 90 }
  const viewport = domeWindow(heading, pitch, horizontalFov)
  const top = domeAltitudeY(viewport.topAltitude, area.y, area.h)
  const bottom = domeAltitudeY(viewport.bottomAltitude, area.y, area.h)
  const centerX = area.x + viewport.centerBearing / 360 * area.w
  const centerY = domeAltitudeY(viewport.centerAltitude, area.y, area.h)
  const horizonY = domeAltitudeY(0, area.y, area.h)

  return <div className="sky-dome" aria-label="Current sky camera orientation">
    <div className="sky-dome-title">
      <strong>Sky orientation</strong>
      <span>{Math.round(viewport.centerBearing)}° · {Math.round(pitch)}° alt</span>
    </div>
    <svg viewBox="0 0 278 142" role="img"
      aria-label={`Sky dome: looking ${Math.round(viewport.centerBearing)} degrees clockwise from north and ${Math.round(pitch)} degrees above the horizon. Gold rectangle shows the part of the sky currently visible.`}>
      <defs>
        <linearGradient id="sky-dome-shading" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#081427"/>
          <stop offset="70%" stopColor="#244557"/>
          <stop offset="100%" stopColor="#304b52"/>
        </linearGradient>
        <clipPath id="sky-dome-window-clip">
          <rect x={area.x} y={area.y} width={area.w} height={area.h} rx="5"/>
        </clipPath>
      </defs>
      <path d="M19 30 Q139 -14 259 30" fill="none" stroke="#b0c5c3" strokeWidth="1.5" opacity=".55"/>
      <rect x={area.x} y={area.y} width={area.w} height={area.h} rx="5"
        fill="url(#sky-dome-shading)" stroke="#64828a" strokeWidth=".8"/>
      <g clipPath="url(#sky-dome-window-clip)">
        <rect x={area.x} y={horizonY} width={area.w} height={area.y + area.h - horizonY}
          fill="#162a35" opacity=".88"/>
        {[45, 90, 135, 180, 225, 270, 315].map(deg =>
          <line key={deg} x1={area.x + deg / 360 * area.w} x2={area.x + deg / 360 * area.w}
            y1={area.y} y2={area.y+area.h} stroke="#8aa8aa" strokeWidth=".55" strokeOpacity=".24"/>)}
        {[45, 0].map(alt =>
          <line key={alt} x1={area.x} x2={area.x + area.w}
            y1={domeAltitudeY(alt, area.y, area.h)}
            y2={domeAltitudeY(alt, area.y, area.h)}
            stroke={alt === 0 ? '#e3cba4' : '#a5c0be'}
            strokeWidth={alt === 0 ? 1.1 : .65} strokeDasharray={alt === 0 ? undefined : '3 4'}
            strokeOpacity={alt === 0 ? .65 : .3}/>)}
        {viewport.spans.map((span,i) =>
          <rect key={i} x={area.x + span.startDeg / 360 * area.w} y={top}
            width={span.widthDeg / 360 * area.w} height={Math.max(1.5, bottom-top)}
            rx="2" fill="#f2cb8c" fillOpacity=".24"
            stroke="#ffe3b2" strokeWidth="2"/>)}
        <line x1={centerX} x2={centerX} y1={area.y} y2={area.y+area.h}
          stroke="#ffe1a5" strokeOpacity=".5" strokeDasharray="2 4"/>
        <circle cx={centerX} cy={centerY} r="3" fill="#fff1c9" stroke="#4f3921" strokeWidth=".7"/>
      </g>
      {[['N',0],['E',90],['S',180],['W',270],['N',360]].map(([cardinal,bearing],i) =>
        <text key={i} x={area.x + Number(bearing) / 360 * area.w} y="25"
          textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
          className="sky-dome-cardinal">{cardinal}</text>)}
      <text x="14" y={area.y + 6} textAnchor="end" className="sky-dome-level">90°</text>
      <text x="14" y={horizonY + 3} textAnchor="end" className="sky-dome-level">0°</text>
      <text x="139" y="135" textAnchor="middle" className="sky-dome-footnote">Gold box = current view · Horizon at 0°</text>
    </svg>
  </div>
}
