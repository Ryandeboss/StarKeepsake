import { useEffect, useMemo, useState } from 'react'
import { generateAstronomy } from '../api'
import type { AstronomyResult } from '../api'
import { EarthGlobe } from '../components/EarthGlobe'
import { SiteHeader } from '../components/SiteHeader'
import { INITIAL_DESIGN_SPEC } from '../designSpec'
import { EXPLORER_LOCATIONS } from '../skyExplorerData'
import type { ExplorerLocation } from '../skyExplorerData'
import { starDisplayName, starDescription } from '../starDetails'
import './SkyLabPage.css'

function stepUtc(date: string, time: string, hours: number): { date: string; time: string } {
  const next = new Date(`${date}T${time}:00Z`)
  next.setUTCHours(next.getUTCHours() + hours)
  return { date: next.toISOString().slice(0, 10), time: next.toISOString().slice(11, 16) }
}

function SkyPanorama({ result }: { result: AstronomyResult | null }) {
  const [selectedHip, setSelectedHip] = useState<number | null>(null)
  const selected = result?.stars.find((star) => star.hipparcosId === selectedHip)

  return (
    <div className="sky-panorama">
      <svg viewBox="0 0 1000 455" role="img"
        aria-label="Calculated panoramic above-horizon Hipparcos stars, west left, north center, east right">
        <defs>
          <linearGradient id="sky-lab-night" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#061122"/>
            <stop offset="70%" stopColor="#112f46"/>
            <stop offset="100%" stopColor="#33616a"/>
          </linearGradient>
          <radialGradient id="sky-lab-haze">
            <stop offset="0" stopColor="#d4b27a" stopOpacity=".24"/>
            <stop offset="1" stopColor="#d4b27a" stopOpacity="0"/>
          </radialGradient>
          <filter id="sky-lab-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2.3"/>
          </filter>
        </defs>
        <rect width="1000" height="455" fill="url(#sky-lab-night)"/>
        <ellipse cx="510" cy="435" rx="620" ry="230" fill="url(#sky-lab-haze)" />
        {[90, 180, 270, 360].map((y) => (
          <g key={y}>
            <path d={`M0 ${y} H1000`} stroke="#bad5db" strokeOpacity=".16" strokeDasharray="4 11"/>
            <text x="15" y={y - 8} fill="#c3d6d9" fontSize="11" opacity=".7">
              {90 - Math.round(y / 400 * 90)}° alt
            </text>
          </g>
        ))}
        {[0, 250, 500, 750, 1000].map((x) => (
          <path key={x} d={`M${x} 0 V405`} stroke="#c6dce1" strokeOpacity=".085"/>
        ))}
        {result?.stars.map((star) => {
          const x = (((star.azimuthDeg + 180) % 360) / 360) * 1000
          const y = (90 - star.altitudeDeg) / 90 * 400
          const radius = Math.max(1.2, 3.5 - star.magnitude * .38)
          return (
            <g key={star.hipparcosId} className="sky-panorama-star"
              onMouseEnter={() => setSelectedHip(star.hipparcosId)}
              onMouseLeave={() => setSelectedHip(null)}
              onFocus={() => setSelectedHip(star.hipparcosId)}
              onBlur={() => setSelectedHip(null)}
              onClick={() => setSelectedHip(star.hipparcosId)}
              tabIndex={0} role="button" aria-label={starDescription(star)}>
              <circle cx={x} cy={y} r={Math.max(11, radius + 6)} fill="transparent"/>
              <circle cx={x} cy={y} r={radius + 3} fill="#ffe9b5" opacity=".3" filter="url(#sky-lab-glow)"/>
              <circle cx={x} cy={y} r={radius} fill="#fff1cd"/>
              <title>{starDescription(star)}</title>
            </g>
          )
        })}
        <path d="M0 407 Q240 409 485 407 Q730 404 1000 407 L1000 455 L0 455Z" fill="#071d27" fillOpacity=".78" />
        <path d="M0 407 H1000" stroke="#dabf8a" strokeOpacity=".75" strokeWidth="1.4"/>
        {['S','W','N','E','S'].map((label, index) => (
          <text key={index} x={index * 250 || 10} y="437"
            textAnchor={index === 0 ? 'start' : index === 4 ? 'end' : 'middle'}
            fontSize="15" fill="#f5dbac" fontFamily="monospace">{label}</text>
        ))}
        <text x="500" y="27" textAnchor="middle" fontSize="11" letterSpacing="3" fill="#d4e5e8">
          ALL-SKY HORIZON PANORAMA
        </text>
      </svg>
      <div className="sky-panorama-info" aria-live="polite">
        {selected ? (
          <span><strong>{starDisplayName(selected)}</strong> · HIP {selected.hipparcosId} · altitude {selected.altitudeDeg.toFixed(1)}° · azimuth {selected.azimuthDeg.toFixed(1)}° · magnitude {selected.magnitude.toFixed(2)}</span>
        ) : (
          <span>Hover, tap, or focus a plotted star to inspect its real catalogue coordinates.</span>
        )}
      </div>
    </div>
  )
}

export function SkyLabPage() {
  const [selected, setSelected] = useState<ExplorerLocation>(EXPLORER_LOCATIONS[0])
  const [view, setView] = useState<'earth' | 'sky'>('earth')
  const [date, setDate] = useState('2024-07-04')
  const [time, setTime] = useState('22:00')
  const [playing, setPlaying] = useState(false)
  const [result, setResult] = useState<AstronomyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const utcMoment = useMemo(() => new Date(`${date}T${time}:00Z`), [date, time])
  const dateError = !Number.isFinite(utcMoment.getTime()) ||
    utcMoment.getUTCFullYear() < 1850 || utcMoment.getUTCFullYear() > 2149
    ? 'Choose a date between 1850 and 2149.'
    : ''

  useEffect(() => {
    if (view !== 'sky' || !date || !time) return
    if (dateError) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const sky = await generateAstronomy({
          date, time, exactTimeUnknown: false,
          location: {
            query: selected.name,
            displayName: selected.name,
            formattedAddress: selected.name,
            latitude: selected.latitude,
            longitude: selected.longitude,
            timeZoneId: 'UTC',
            confidence: 'High',
          },
          localDateTime: `${date}T${time}:00`,
          utcDateTime: utcMoment.toISOString(),
        }, {
          ...INITIAL_DESIGN_SPEC.skySettings,
          magnitudeLimit: 6,
          maxStars: 150,
          minSeparationMm: 1.5,
        }, '11x14')
        if (!cancelled) setResult(sky)
      } catch (cause) {
        if (!cancelled) {
          setResult(null)
          setPlaying(false)
          setError(cause instanceof Error ? cause.message : 'Astronomy calculation unavailable.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [view, selected, date, time, utcMoment, dateError])

  useEffect(() => {
    if (!playing || view !== 'sky') return
    // ~7.5 requests/min, below the astronomy API's 20/min IP rate limit.
    const timer = window.setInterval(() => {
      const next = stepUtc(date, time, 1)
      setDate(next.date)
      setTime(next.time)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [playing, view, date, time])

  return (
    <div className="site-shell sky-lab-shell">
      <SiteHeader currentPage="sky-lab"/>
      <main className="sky-lab-page">
        <section className="sky-lab-hero">
          <p className="sky-lab-eyebrow">StarKeepsake / The observatory</p>
          <h1>Stand anywhere on Earth.<br/><em>Discover the sky above it.</em></h1>
          <p>Pick an observing place, journey from the globe to the horizon, and change the date and time to see real calculated stars move across the sky.</p>
          <div className="sky-lab-progress"><span className={view === 'earth' ? 'is-active' : ''}>01 · The Earth</span><span className={view === 'sky' ? 'is-active' : ''}>02 · The Night Sky</span></div>
        </section>

        {view === 'earth' ? (
          <EarthGlobe selected={selected} onSelect={setSelected} onEnterSky={() => setView('sky')}/>
        ) : (
          <section className="sky-observer-section">
            <div className="sky-observer-title">
              <button type="button" className="sky-back-button" onClick={() => { setPlaying(false); setView('earth') }}>← Back to Earth</button>
              <div>
                <span className="sky-lab-eyebrow">Observing from {selected.name}</span>
                <h2>The sky, from your place on Earth.</h2>
                <p>{selected.latitude.toFixed(3)}° latitude · {selected.longitude.toFixed(3)}° longitude · UTC controls</p>
              </div>
            </div>
            <div className="sky-lab-controls">
              <label>Date (UTC)<input type="date" min="1850-01-01" max="2149-12-31" value={date}
                onChange={(e) => { setPlaying(false); setDate(e.target.value) }} /></label>
              <label>Time (UTC)<input type="time" step="3600" value={time}
                onChange={(e) => { setPlaying(false); setTime(e.target.value) }} /></label>
              <div className="sky-play-group">
                <button type="button" className="sky-lab-primary"
                  aria-pressed={playing} onClick={() => setPlaying(!playing)}>
                  {playing ? '❚❚ Pause motion' : '▶ Animate the sky'}
                </button>
                <span>Steps 1 hour every 8 seconds · each step recalculated</span>
              </div>
              <button type="button" className="sky-step-button"
                onClick={() => { const next = stepUtc(date,time,1); setDate(next.date);setTime(next.time) }}>
                + 1 hour
              </button>
            </div>
            <div className="sky-current-time">{utcMoment.toLocaleString('en-US', { timeZone:'UTC', dateStyle:'full', timeStyle:'short' })} UTC</div>
            <SkyPanorama result={result}/>
            <p className="sky-loading-status" role="status">{loading ? 'Calculating the star field from Hipparcos and JPL data…' : dateError || error || (result
              ? `${result.calculation.selectedStars} actual plotted HIP stars · ${result.calculation.visibleCatalogStars} catalogue stars above the ideal horizon · exact time basis`
              : 'Choose a date and time to calculate the view.')}</p>
            <div className="sky-explainer-cards">
              <article><span>01 / Observer</span><h3>Where you stand matters</h3><p>Latitude and longitude determine your local horizon. Moving from Chicago to Sydney reveals a different portion of the celestial sphere.</p></article>
              <article><span>02 / Earth rotates</span><h3>The stars appear to travel</h3><p>As Earth rotates, a star's apparent altitude and azimuth change. Each animation step requests a new astronomical calculation; transitions between steps are visual.</p></article>
              <article><span>03 / Projection</span><h3>From sky to artwork</h3><p>This is a complete 360° altitude/azimuth panorama, not a camera's field of view. North is centered and the ideal horizon is the lower line.</p></article>
            </div>
          </section>
        )}

        <section className="sky-history">
          <div><p className="sky-lab-eyebrow">A practice more than 3,000 years old</p><h2>Humans have been finding order in the stars for millennia.</h2></div>
          <div>
            <p>People have tracked the movements of the night sky since ancient times. Systematic records of stellar observations existed in Mesopotamia by about 1000 BCE. Around the second century BCE, Hipparchus compiled a catalogue of hundreds of star positions using naked-eye observations and instruments. Modern spacecraft—such as ESA's Hipparcos mission—later measured stellar positions far more precisely. Today, StarKeepsake combines the Hipparcos catalogue with the Skyfield astronomy library and a JPL planetary ephemeris to calculate which stars were above the horizon at a chosen place and time.</p>
            <div className="sky-history-sources">
              <a href="https://sci.esa.int/documents/33580/36006/1567260353925-ESA_Gaia_DR2_MediaKit_23042018.pdf" target="_blank" rel="noopener noreferrer">ESA · History of astrometry</a>
              <a href="https://rhodesmill.org/skyfield/positions.html" target="_blank" rel="noopener noreferrer">Skyfield · Apparent positions</a>
              <a href="https://openstax.org/books/astronomy-2e/pages/2-2-ancient-astronomy" target="_blank" rel="noopener noreferrer">OpenStax · Ancient astronomy</a>
            </div>
          </div>
        </section>
        <div className="sky-lab-footer-cta">
          <span>Turn your own special moment into a keepsake.</span>
          <a href="/create">Create your frame <span aria-hidden="true">↗</span></a>
        </div>
      </main>
    </div>
  )
}
