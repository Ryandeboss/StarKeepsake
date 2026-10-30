import type { ExplorerLocation } from '../skyExplorerData'
import { getObserverScene, observerHorizonY } from '../skyLandscapeData'
import { projectObserverStar } from '../skyImmersiveData'

// Original city-inspired illustration. Astronomical star positions alone are
// georeferenced; no exact landmark bearings are claimed.
const wet = new Set(['lake', 'river', 'harbour', 'coast'])
const noise = (n: number, seed: number) => {
  const v = Math.sin((n + seed) * 78.233) * 43758.5453
  return v - Math.floor(v)
}
const wrap = (value: number, span: number) => ((value % span) + span) % span

function IconicLandmark({ id }: { id: string }) {
  switch (id) {
    case 'chicago':
      return <g fill="#101f31" stroke="#527381" strokeWidth=".8">
        <path d="M472 0 V-113 H482 V-145 H490 V-113 H505 V-181 H512 V-113 H524 V0Z"/>
        <path d="M472 -106 H524" stroke="#708a91" strokeWidth="1"/>
        <path d="M480 -99 V-20 M491 -102 V-24 M506 -104 V-24 M516 -104 V-20" stroke="#a6b4ab" strokeOpacity=".28" strokeWidth="1.8"/>
        <rect x="532" y="-94" width="22" height="94"/>
        <path d="M542 -94 V-132" stroke="#9ea6a8" strokeWidth="2"/>
      </g>
    case 'london':
      return <g fill="#132333" stroke="#b7a37f" strokeOpacity=".65" strokeWidth="1">
        <path d="M484 0 V-103 H477 V-117 H481 V-139 H485 V-146 H495 V-139 H499 V-117 H505 V-103 H500 V0Z"/>
        <path d="M489 -145 V-159 M491 -159 V-162" stroke="#d0b88d" strokeWidth="1.5"/>
        <rect x="484" y="-112" width="16" height="15" fill="#ddc58d" fillOpacity=".75"/>
        <circle cx="492" cy="-105" r="6" fill="#f5e8bb" stroke="#42424b"/>
        <path d="M492 -105 L492 -109 M492 -105 L496 -103" stroke="#283c45"/>
        <path d="M526 0 V-80 H534 V-109 H537 V-80 H545 V0Z" fill="#152b3d"/>
      </g>
    case 'tokyo':
      return <g stroke="#bd8780" strokeWidth="2" fill="#1b2c3a">
        <path d="M497 0 L503 -155 L508 0 Z"/>
        <path d="M501 -155 L503 -190 L505 -155" strokeWidth="2"/>
        <path d="M489 -100 H517 M492 -74 H514 M495 -48 H511 M498 -124 H509" stroke="#d8b5a2" strokeWidth="3"/>
        <ellipse cx="503" cy="-108" rx="15" ry="5" fill="#a6a8a4"/>
        <path d="M468 0 V-85 H478 V-99 H488 V0" fill="#1a303e" stroke="#5c8191"/>
      </g>
    case 'sydney':
      return <g stroke="#a0a6a3" strokeWidth="2" fill="#152d3a">
        <path d="M362 0 V-30 Q460 -139 558 -30 V0" fill="none"/>
        <path d="M362 -29 Q460 -109 558 -29 M363 -26 H558 M380 -12 H543" fill="none" stroke="#b5a999"/>
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${382 + i * 19} -15 V${-44 - Math.sin(i / 8 * Math.PI) * 47}`} stroke="#a0adb1" strokeWidth="1"/>)}
        <path d="M593 0 Q573 -52 615 -66 Q608 -36 635 0Z" fill="#9ab0ac" stroke="none"/>
        <path d="M614 0 Q601 -48 642 -58 Q641 -32 667 0Z" fill="#b9c4bb" stroke="none"/>
        <path d="M638 0 Q628 -38 663 -44 Q665 -18 682 0Z" fill="#829c9a" stroke="none"/>
      </g>
    case 'capetown':
      return <g fill="#142b38">
        <path d="M65 0 L150 -54 L260 -99 L330 -132 L455 -139 L575 -136 L642 -83 L734 -32 L857 0 Z"/>
        <path d="M330 -132 L455 -139 L575 -136" fill="none" stroke="#80918a" strokeOpacity=".6" strokeWidth="3"/>
      </g>
    case 'rio':
      return <g fill="#0e2534">
        <path d="M180 0 Q258 -23 290 -72 Q314 -148 352 -139 Q375 -127 390 -67 Q402 -25 470 0 Z"/>
        <path d="M630 0 Q674 -30 685 -78 Q698 -127 714 -103 Q731 -70 762 0Z"/>
        <path d="M713 -103 V-128 M701 -117 H725" stroke="#6c8a88" strokeWidth="3"/>
      </g>
    case 'reykjavik':
      return <g fill="#1c3442" stroke="#7c9a94" strokeWidth="1.3">
        <path d="M492 0 V-89 L500 -140 L508 -89 V0Z"/>
        <path d="M483 0 V-79 L491 -107 V0 M509 0 V-107 L517 -79 V0"/>
        <path d="M474 0 V-55 L481 -77 V0 M518 0 V-77 L525 -55 V0"/>
        <path d="M492 -58 H508 M496 -66 H504" stroke="#d2c7a7"/>
        <rect x="462" y="-18" width="76" height="18" fill="#1d394a"/>
      </g>
    case 'mumbai':
      return <g stroke="#9e9681" strokeWidth="1.6" fill="#172c3b">
        <path d="M450 0 V-74 L462 -88 H550 L562 -74 V0Z"/>
        <path d="M467 0 V-43 A39 39 0 0 1 545 -43 V0 H530 V-42 A24 24 0 0 0 482 -42 V0Z" fill="#314352"/>
        <path d="M462 -88 V-109 H471 V-88 M541 -88 V-109 H550 V-88" />
        <path d="M448 -76 H564" />
        <path d="M473 -86 Q506 -114 539 -86" fill="none"/>
      </g>
    default:
      return null
  }
}

function Terrain({ id, seed }: { id: string; seed: number }) {
  if (id === 'capetown') {
    return <path d="M0 0 L0 -23 L110 -52 L225 -96 L340 -119 L470 -121 L592 -116 L702 -61 L830 -29 L1000 -16 L1000 0 Z" fill="#1e3d4a"/>
  }
  if (id === 'rio') {
    return <path d="M0 0 L0 -30 Q85 -12 120 -45 Q156 -105 192 -84 Q232 -43 300 -30 Q385 -16 450 -43 Q520 -105 558 -67 Q614 -16 673 -43 Q745 -100 792 -56 Q843 -17 1000 -30 L1000 0 Z" fill="#254656"/>
  }
  if (id === 'tokyo') {
    return <path d="M0 0 L0 -20 L120 -28 L200 -34 L280 -45 L325 -56 L370 -93 L416 -142 L458 -102 L506 -66 L545 -31 L800 -25 L1000 -20 L1000 0 Z" fill="#2b4c5c"/>
  }
  if (id === 'reykjavik') {
    return <path d="M0 0 L0 -18 Q130 -32 234 -63 Q335 -107 480 -70 Q633 -28 760 -51 Q856 -78 1000 -42 L1000 0 Z" fill="#223a4c"/>
  }
  const rise = 12 + noise(1, seed) * 25
  return <path d={`M0 0 V-${rise} Q160 -${rise+9} 280 -${rise+3} Q470 -${rise+25} 600 -${rise} Q840 -${rise+5} 1000 -${rise+11} V0Z`} fill="#1b3647"/>
}

function BuildingBand({ seed, quiet }: { seed: number; quiet: boolean }) {
  return <g>
    {Array.from({ length: quiet ? 28 : 44 }, (_, i) => {
      const spacing = quiet ? 36 : 24
      const x = i * spacing - 8
      const width = (quiet ? 22 : 15) + noise(i, seed + 10) * (quiet ? 19 : 23)
      const height = (quiet ? 12 : 25) + noise(i, seed) * (quiet ? 44 : 92)
      return <g key={i}>
        <rect x={x} y={-height} width={width} height={height+7} fill={i % 2 ? '#172c3b' : '#203747'}/>
        {Array.from({ length: Math.floor(height / 14) }, (_, row) =>
          Array.from({ length: Math.max(1, Math.floor(width / 8)) }, (_, col) => {
            if (noise(i*41+row*7+col, seed) < .58) return null
            return <rect key={row * 10 + col} x={x + 3 + col*8} y={-height+8+row*13} width="2.2" height="3.3"
              fill={noise(i + row*8 + col, seed) > .5 ? '#f1bf81' : '#9cc5c7'} opacity=".65"/>
          }),
        )}
      </g>
    })}
  </g>
}

type Props = { location: ExplorerLocation; heading: number; pitch: number; fov: number }

export function SkyCityHorizon({ location, heading, pitch, fov }: Props) {
  const scene = getObserverScene(location.id)
  const horizonY = observerHorizonY(heading, pitch, fov)
  const water = wet.has(scene.terrain)
  const rad = Math.PI / 180
  const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180
  const markerBearing: Record<string, number> = {
    chicago: 170, london: 170, tokyo: 170, sydney: 170,
    capetown: 170, rio: 170, reykjavik: 170, mumbai: 170,
  }
  // Sample an azimuth-based skyline: buildings and stars now turn in the
  // SAME perspective camera. There is no separate screen-space parallax speed.
  const skyline = Array.from({ length: 58 }, (_, i) => {
    const bearing = (i * 360 / 58 + scene.seed * 1.27) % 360
    if (Math.abs(angleDiff(bearing, heading)) > fov / 2 + 8) return null
    const heightDeg = 1.6 + noise(i, scene.seed) * (scene.terrain === 'mountains' ? 3.8 : 10)
    const base = projectObserverStar(bearing, 0, heading, pitch, fov)
    const top = projectObserverStar(bearing, heightDeg, heading, pitch, fov)
    const west = projectObserverStar(bearing - .72, 0, heading, pitch, fov)
    const east = projectObserverStar(bearing + .72, 0, heading, pitch, fov)
    const width = Math.min(45, Math.max(5, Math.abs(east.x - west.x)))
    const height = Math.max(3, base.y - top.y)
    if (!Number.isFinite(base.x) || !Number.isFinite(height) || base.x < -90 || base.x > 1090) return null
    return <g key={i}>
      <rect x={base.x - width / 2} y={top.y} width={width} height={height}
        fill={i % 3 === 0 ? '#213b48' : '#122c3a'}/>
      {Array.from({ length: Math.min(8, Math.floor(height / 13)) }, (_, j) =>
        Array.from({ length: Math.min(4, Math.floor(width / 9)) }, (_, k) => {
          if (noise(i * 37 + j * 9 + k, scene.seed) < .67) return null
          return <rect key={j * 10 + k} x={base.x - width / 2 + 3 + k * 9}
            y={top.y + 6 + j * 13} width="2.4" height="3" opacity=".65"
            fill={noise(i+j+k, 33) > .5 ? '#f5c486' : '#87aebb'}/>
        }),
      )}
    </g>
  })
  const terrainPath = Array.from({ length: 65 }, (_, i) => {
    const x = i * 1000 / 64
    const d = Math.atan(((x - 500) / 500) * Math.tan(fov * rad / 2)) / rad
    const bearing = heading + d
    const h = scene.terrain === 'mountains'
      ? 2.1 + Math.abs(Math.sin(bearing * rad * 2.8 + scene.seed)) * 3.1
      : scene.terrain === 'coast' ? .8 : .5
    const point = projectObserverStar(bearing, h, heading, pitch, fov)
    return `${x} ${point.y}`
  })
  const terrainOutline = `M ${terrainPath.join(' L ')} L 1000 660 L 0 660 Z`
  const markerAz = markerBearing[location.id] ?? 170
  const markerBase = projectObserverStar(markerAz, 0, heading, pitch, fov)
  const markerTop = projectObserverStar(markerAz, 12, heading, pitch, fov)
  const markerScale = Math.max(.1, Math.min(2.2, (markerBase.y - markerTop.y) / 180))
  return <g pointerEvents="none" aria-hidden="true">
    <defs>
      <linearGradient id="observer-scene-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={water ? '#2e4e59' : '#213d47'}/>
        <stop offset="100%" stopColor="#050d19"/>
      </linearGradient>
      <radialGradient id="observer-city-glow">
        <stop offset="0" stopColor="#e7b47d" stopOpacity=".12"/>
        <stop offset="1" stopColor="#e7b47d" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="500" cy={horizonY} rx="650" ry="190" fill="url(#observer-city-glow)"/>
    <path d={terrainOutline} fill="url(#observer-scene-gradient)"/>
    {skyline}
    {Math.abs(angleDiff(markerAz, heading)) < fov/2 + 8 &&
      markerBase.x > -180 && markerBase.x < 1180 &&
      markerScale > 0 &&
      <g transform={`translate(${markerBase.x - 500 * markerScale} ${markerBase.y}) scale(${markerScale})`}>
        <IconicLandmark id={location.id}/>
      </g>}
  </g>
}
