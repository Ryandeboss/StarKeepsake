import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { generateAstronomy, resolveMoment, searchLocations } from '../api'
import type { AstronomyResult, LocationCandidate } from '../api'
import { SkyImmersiveView } from '../components/SkyImmersiveView'
import { SkyCutoutPreview } from '../components/SkyCutoutPreview'
import { StarKeepsakePreview } from '../components/StarKeepsakePreview'
import { FULL_PHOTO_CROP } from '../photoCrop'
import { getFrameLayout, INITIAL_DESIGN_SPEC, toRect } from '../designSpec'
import type { DesignSpec } from '../designSpec'
import type { ExplorerLocation } from '../skyExplorerData'
import { resolveSampleMoment } from '../sampleLocationFallback'
import { isOfflineCity, searchOfflineCities } from '../offlineCitySearch'
import { DEFAULT_PHOTO_FIT, DEFAULT_SKY_SPLIT, withSkyPhotoBalance } from '../frameSkyBalance'
import type { AbovePhotoFitMode } from '../frameSkyBalance'
import './ExperiencePage.css'

type Editor = 'moment' | 'photo'
type Composition = 'above' | 'within'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

function BuildAnimation({ progress }: { progress: number }) {
  const stage = progress < 31 ? 'Locating your moment'
    : progress < 65 ? 'Calculating the stars'
    : progress < 95 ? 'Composing your keepsake'
    : 'Your sky is ready'
  return (
    <div className="ex-build-overlay" role="status" aria-live="polite">
      <div className="ex-build-orbit" aria-hidden="true">
        <i/><i/><i/><span>✦</span>
      </div>
      <p className="ex-eyebrow">STARKEEP / SKY COMPUTATION</p>
      <strong>{stage}</strong>
      <div className="ex-build-progress" role="progressbar"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}
        aria-label="Illustrative progress while calculating your sky">
        <span style={{ width: progress + '%' }}/>
      </div>
      <small>{Math.round(progress)}% · Visual estimate, not server-reported progress</small>
    </div>
  )
}

export function ExperiencePage() {
  const [designSpec, setDesignSpec] = useState<DesignSpec>(() => ({
    ...INITIAL_DESIGN_SPEC, stars: [], astronomy: null,
  }))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null)
  const [editor, setEditor] = useState<Editor>('moment')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('21:00')
  const [exactTimeUnknown, setExactTimeUnknown] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationCandidates, setLocationCandidates] = useState<LocationCandidate[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationCandidate | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState(8)
  const [built, setBuilt] = useState(false)
  const [composition, setComposition] = useState<Composition>('above')
  const [skyHeightPercent, setSkyHeightPercent] = useState(DEFAULT_SKY_SPLIT)
  const [photoFitMode, setPhotoFitMode] = useState<AbovePhotoFitMode>(DEFAULT_PHOTO_FIT)
  const [cutoutUrl, setCutoutUrl] = useState('')
  const [cutoutEditorOpen, setCutoutEditorOpen] = useState(false)
  const [cutoutEditorMounted, setCutoutEditorMounted] = useState(false)
  const [mapsUnavailable, setMapsUnavailable] = useState(false)
  const [showObservatory, setShowObservatory] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const photoObjectUrl = useRef('')
  const cutoutObjectUrl = useRef('')
  const revision = useRef(0)
  const activeBuild = useRef(0)

  useEffect(() => () => {
    revision.current += 1
    if (photoObjectUrl.current) URL.revokeObjectURL(photoObjectUrl.current)
    if (cutoutObjectUrl.current) URL.revokeObjectURL(cutoutObjectUrl.current)
  }, [])

  useEffect(() => {
    if (!isBuilding) return
    const interval = window.setInterval(() => {
      setBuildProgress(current => Math.min(92, current + Math.max(.6, (92 - current) * .12)))
    }, 190)
    return () => window.clearInterval(interval)
  }, [isBuilding])

  function invalidateSky() {
    revision.current += 1
    setBuilt(false)
    setShowObservatory(false)
    setError('')
    setDesignSpec(current => ({ ...current, astronomy: null, stars: [] }))
    // Preserve the photo cutout when only the date/location changes.
  }

  function receivePhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > MAX_PHOTO_BYTES) {
      setError('Choose a JPG, PNG or WebP image smaller than 10 MB.')
      return
    }

    invalidateSky()
    if (cutoutObjectUrl.current) URL.revokeObjectURL(cutoutObjectUrl.current)
    cutoutObjectUrl.current = ''
    setCutoutUrl('')
    setCutoutEditorOpen(false)
    setCutoutEditorMounted(false)
    if (photoObjectUrl.current) URL.revokeObjectURL(photoObjectUrl.current)
    const url = URL.createObjectURL(file)
    photoObjectUrl.current = url
    setPhotoFile(file)
    setPhotoUrl(url)
    setSourceDimensions(null)
    setEditor('moment')
    const currentRevision = revision.current
    void createImageBitmap(file).then(bitmap => {
      const width = bitmap.width
      const height = bitmap.height
      bitmap.close()
      if (revision.current !== currentRevision) return
      if (width <= 0 || height <= 0) {
        setError('We could not read this photo. Try another image.')
        return
      }
      const ratio = Math.max(.35, Math.min(3, width / height))
      const { physicalArtwork, regions } = getFrameLayout('auto', ratio)
      setSourceDimensions({ width, height })
      setDesignSpec(current => ({
        ...current,
        framePresetId: 'auto',
        photoAspectRatio: ratio,
        physicalArtwork,
        regions,
        photo: {
          ...current.photo, assetId: 'local-photo-preview',
          fitMode: 'contain', crop: FULL_PHOTO_CROP,
          positionMm: toRect(regions.engravingPhoto),
        },
        customText: { ...current.customText, positionMm: toRect(regions.text) },
        astronomy: null,
        stars: [],
      }))
    }).catch(() => setError('Could not decode the photo. Try a different file.'))
  }

  function onFileDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragging(false)
    receivePhoto(event.dataTransfer.files[0])
  }

  function selectEditor(next: Editor) {
    setEditor(next)
    if (next === 'photo') {
      fileInputRef.current?.click()
    } else {
      window.requestAnimationFrame(() => dateInputRef.current?.focus())
    }
  }

  async function findLocation() {
    if (locationQuery.trim().length < 2) {
      setError('Enter at least two characters of a city, town or address.')
      return
    }
    setIsSearching(true)
    setError('')
    setLocationCandidates([])
    try {
      // Prefer the real Azure Maps service whenever it is configured.
      // If staging is missing its key, fall back to the local city gazetteer.
      const matches = mapsUnavailable
        ? await searchOfflineCities(locationQuery)
        : await searchLocations(locationQuery)
      setLocationCandidates(matches)
      if (!matches.length) setError(mapsUnavailable
        ? 'No matching city found. Try another spelling. Precise addresses require the live location service.'
        : 'No matching places found. Try a nearby city or a fuller address.')
    } catch (cause) {
      try {
        const cities = await searchOfflineCities(locationQuery)
        setMapsUnavailable(true)
        setLocationCandidates(cities)
        if (!cities.length) {
          setError('Live maps are unavailable, and no city matches this search. Try a city or town instead.')
        }
      } catch {
        setError(cause instanceof Error ? cause.message : 'Location search is unavailable.')
      }
    } finally {
      setIsSearching(false)
    }
  }

  function openCutoutEditor() {
    if (!photoFile) { setError('Upload a photo first.'); return }
    setCutoutEditorMounted(true)
    setCutoutEditorOpen(true)
  }

  function applyCutout(blob: Blob) {
    if (cutoutObjectUrl.current) URL.revokeObjectURL(cutoutObjectUrl.current)
    const url = URL.createObjectURL(blob)
    cutoutObjectUrl.current = url
    setCutoutUrl(url)
    setCutoutEditorOpen(false)
    setComposition('within')
    setDesignSpec(current => ({ ...current, layoutMode: 'horizon-blend' }))
  }

  async function buildFrame() {
    if (isBuilding) return
    if (!photoFile || !sourceDimensions) {
      setError('Add a photo first, using the frame or the upload area.')
      return
    }
    if (!date) { setError('Choose the date of your special moment.'); setEditor('moment'); return }
    if (!exactTimeUnknown && !time) {
      setError('Choose a time or select Exact time unknown.')
      return
    }
    if (!selectedLocation) {
      setError('Search for your location and choose a result.')
      return
    }
    const requestId = ++activeBuild.current
    const expectedRevision = revision.current
    setError('')
    setBuilt(false)
    setIsBuilding(true)
    setBuildProgress(8)

    try {
      const moment = isOfflineCity(selectedLocation)
        ? resolveSampleMoment(date, exactTimeUnknown ? null : time, exactTimeUnknown, selectedLocation)
        : await resolveMoment({
          date, time: exactTimeUnknown ? null : time,
          exactTimeUnknown, locationQuery, location: selectedLocation,
        })
      if (requestId !== activeBuild.current || expectedRevision !== revision.current) return

      const calculated = await generateAstronomy(
        moment, designSpec.skySettings, designSpec.framePresetId, designSpec.photoAspectRatio,
      )
      if (requestId !== activeBuild.current || expectedRevision !== revision.current) return

      setDesignSpec(current => ({
        ...current, moment,
        astronomy: calculated.calculation,
        stars: calculated.stars,
      }))
      setBuildProgress(100)
      setBuilt(true)
      setEditor('moment')
    } catch (cause) {
      if (requestId === activeBuild.current && expectedRevision === revision.current) {
        setError(cause instanceof Error ? cause.message : 'Could not calculate this night sky.')
      }
    } finally {
      if (requestId === activeBuild.current) setIsBuilding(false)
    }
  }

  function changeComposition(next: Composition) {
    setComposition(next)
    setCutoutEditorOpen(false)
    setDesignSpec(current => ({
      ...current, layoutMode: next === 'above' ? 'classic' : 'horizon-blend',
    }))
  }

  const displayDesignSpec: DesignSpec = composition === 'above'
    ? withSkyPhotoBalance({ ...designSpec, layoutMode: 'classic' }, skyHeightPercent)
    : { ...designSpec, layoutMode: 'horizon-blend' }

  const explorerLocation: ExplorerLocation | null = designSpec.moment.location
    ? {
      id: 'personal', name: designSpec.moment.location.displayName,
      latitude: designSpec.moment.location.latitude,
      longitude: designSpec.moment.location.longitude,
      subtitle: '',
    }
    : null
  const explorerResult: AstronomyResult | null = designSpec.astronomy
    ? { calculation: designSpec.astronomy, stars: [...designSpec.stars] }
    : null

  return (
    <div className="ex-shell">
      <div className="ex-cosmos" aria-hidden="true">
        <span className="ex-orbit ex-orbit-a"/>
        <span className="ex-orbit ex-orbit-b"/>
        <span className="ex-orbit ex-orbit-c"/>
        <span className="ex-cosmos-glow"/>
      </div>

      <header className="ex-header">
        <a href="/" className="ex-brand" aria-label="StarKeepsake home">
          <span className="ex-brand-symbol">✳</span>
          <span>STAR<span className="ex-brand-accent">KEEPSAKE</span><small>PERSONAL SKY ATLAS</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#builder">The experience</a>
          <a href="#science">Our science</a>
          <span className="ex-header-pill"><span/> Preview studio</span>
        </nav>
      </header>

      <main>
        <section className="ex-hero" id="builder" aria-labelledby="ex-heading">
          <div className="ex-intro">
            <div className="ex-eyebrow"><span className="ex-eyebrow-line"/> THE UNIVERSE, MADE PERSONAL · 001</div>
            <h1 id="ex-heading">Keep a moment.<br/><em>Hold the universe.</em></h1>
            <p className="ex-lede">A photograph from your world. The stars from your night.
              One luminous, personal keepsake—designed here, in real time.</p>
            <div className="ex-intro-detail">
              <span>01 / Add your photograph</span>
              <span>02 / Locate your night</span>
              <span>03 / See it come to life</span>
            </div>
            <div className="ex-info-panel">
              <div className="ex-panel-topline">
                <span>YOUR OBSERVATION</span>
                <span className="ex-panel-dot">● LIVE STUDIO</span>
              </div>
              <div className="ex-upload-panel"
                onDragOver={event => { event.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onFileDrop}>
                <span className="ex-upload-icon" aria-hidden="true">▧</span>
                <div>
                  <strong>{photoFile ? photoFile.name : 'Your photograph goes here'}</strong>
                  <small>{photoFile ? 'Click to replace your image' : 'Drag a photo here, or choose a file.'}</small>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  aria-label={photoFile ? 'Replace photograph' : 'Upload photograph'}>＋</button>
              </div>
              <div className="ex-composition-panel" aria-label="Choose how the stars appear with your photo">
                <p className="ex-choice-eyebrow">01 / SKY & PHOTO PLACEMENT</p>
                <div className="ex-composition-cards" role="group" aria-label="Star placement">
                  <button type="button" className={composition === 'above' ? 'is-selected' : ''}
                    aria-pressed={composition === 'above'} onClick={() => changeComposition('above')}>
                    <span className="ex-composition-illustration ex-composition-above" aria-hidden="true">
                      <span className="ex-composition-stars">✦ · ✧ ·</span>
                      <span className="ex-composition-horizon"/><span className="ex-composition-land"/>
                    </span>
                    <strong>Above my photo</strong><small>Add a separate sky section above the image</small>
                  </button>
                  <button type="button" className={composition === 'within' ? 'is-selected' : ''}
                    aria-pressed={composition === 'within'} onClick={() => changeComposition('within')}>
                    <span className="ex-composition-illustration ex-composition-within" aria-hidden="true">
                      <span className="ex-composition-stars">✦ · ✧ ·</span><span className="ex-composition-land"/>
                    </span>
                    <strong>Within my photo</strong><small>Replace the existing sky at its horizon</small>
                  </button>
                </div>
                {composition === 'above' ? <div className="ex-balance-panel">
                  <div className="ex-balance-title"><label htmlFor="ex-sky-height">Sky section height</label>
                    <strong>{skyHeightPercent}% stars · {100-skyHeightPercent}% photo</strong></div>
                  <div className="ex-balance-preview" aria-hidden="true">
                    <span style={{width:skyHeightPercent+'%'}}>✦ Sky</span><span>▧ Photo</span>
                  </div>
                  <input id="ex-sky-height" type="range" min="20" max="70" step="1" value={skyHeightPercent}
                    onChange={event => setSkyHeightPercent(Number(event.target.value))}/>
                  <div className="ex-balance-labels"><span>More photo</span><span>More stars</span></div>
                  <div className="ex-fit-grid" role="group" aria-label="Photo fit in the frame">
                    {([
                      ['fit','Fit whole'],['center-crop','Center crop'],
                      ['top-crop','Crop top'],['bottom-crop','Crop bottom'],['stretch','Stretch'],
                    ] as const).map(([value,label]) => (
                      <button type="button" key={value} aria-pressed={photoFitMode === value}
                        className={photoFitMode === value ? 'is-selected' : ''}
                        onClick={() => setPhotoFitMode(value)}>{label}</button>
                    ))}
                  </div>
                </div> : <div className="ex-within-option">
                  <p>Remove the existing sky to reveal stars behind your original foreground.</p>
                  {photoFile && <button type="button" onClick={openCutoutEditor}>
                    {cutoutUrl ? '✎ Edit sky cutout' : '✧ Prepare sky cutout'}
                  </button>}
                  <small>AI sky removal is optional and may use a paid model. Local touch-ups are free.</small>
                </div>}
              </div>
              <div className="ex-moment-panel">
                <button type="button" className="ex-moment-heading"
                  onClick={() => setEditor(current => current === 'moment' ? 'photo' : 'moment')}
                  aria-expanded={editor === 'moment'}>
                  <span className="ex-step-indicator">02</span>
                  <span><strong>The sky above you</strong>
                    <small>{selectedLocation?.displayName || 'Date, time and place'}</small></span>
                  <span className="ex-chevron" aria-hidden="true">{editor === 'moment' ? '−' : '+'}</span>
                </button>
                {editor === 'moment' && <div className="ex-moment-fields">
                  <div className="ex-two-fields">
                    <label>THE DATE
                      <input ref={dateInputRef} type="date" min="1850-01-01" max="2149-12-31"
                        value={date} onChange={event => { invalidateSky(); setDate(event.target.value) }}/>
                    </label>
                    <label>LOCAL TIME
                      <input type="time" disabled={exactTimeUnknown} value={time}
                        onChange={event => { invalidateSky(); setTime(event.target.value) }}/>
                    </label>
                  </div>
                  <label className="ex-time-unknown">
                    <input type="checkbox" checked={exactTimeUnknown}
                      onChange={event => { invalidateSky(); setExactTimeUnknown(event.target.checked) }}/>
                    I don't know the exact time
                  </label>
                  <label className="ex-location-label">THE LOCATION
                    <span className="ex-search-row">
                      <input type="search" value={locationQuery} placeholder="Type a city, town or address"
                        onChange={event => {
                          invalidateSky()
                          setLocationQuery(event.target.value)
                          setSelectedLocation(null)
                          setLocationCandidates([])
                        }}
                        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void findLocation() } }}/>
                      <button type="button" onClick={() => void findLocation()} disabled={isSearching}>
                        {isSearching ? '···' : 'Find'}
                      </button>
                    </span>
                  </label>
                  {locationCandidates.length > 0 && <div className="ex-location-results" role="group" aria-label="Choose a location">
                    {locationCandidates.slice(0,7).map((candidate,index) => (
                      <button type="button" key={candidate.formattedAddress + index}
                        className={selectedLocation === candidate ? 'is-selected' : ''}
                        onClick={() => {
                          invalidateSky()
                          setSelectedLocation(candidate)
                          setLocationQuery(candidate.displayName)
                          setLocationCandidates([])
                        }}>
                        <strong>{candidate.displayName}</strong>
                        <small>{candidate.formattedAddress}</small>
                      </button>
                    ))}
                  </div>}
                  {mapsUnavailable && <p className="ex-city-source">
                    City search is available from our offline place database while the live location service is unavailable.
                    Street addresses and landmarks require the live geocoder.
                    {' '}Data © <a href="https://www.geonames.org/" target="_blank"
                      rel="noopener noreferrer">GeoNames</a> (CC BY 4.0).
                  </p>}
                  {(locationCandidates.some(candidate => candidate.source === 'geoapify') ||
                    selectedLocation?.source === 'geoapify') && <p className="ex-city-source">
                    Powered by <a href="https://www.geoapify.com/" target="_blank"
                      rel="noopener noreferrer">Geoapify</a> · OpenStreetMap and other data sources.
                  </p>}
                  {selectedLocation && <div className="ex-location-confirmation">
                    <span aria-hidden="true">✦</span> {selectedLocation.displayName}
                    <small>{isOfflineCity(selectedLocation) ? 'City coordinates and time zone from GeoNames' : 'Location selected'}</small>
                  </div>}
                  <label className="ex-dedication">OPTIONAL MESSAGE
                    <input type="text" maxLength={80}
                      placeholder="A night to remember"
                      value={designSpec.customText.value}
                      onChange={event => setDesignSpec(current => ({
                        ...current,
                        customText: { ...current.customText, value: event.target.value },
                      }))}/>
                  </label>
                </div>}
              </div>

              <div className="ex-material-row">
                <span>FRAME FINISH</span>
                <div role="group" aria-label="Frame finish">
                  {(['midnight','walnut','brass'] as const).map(material => (
                    <button type="button" key={material}
                      className={`ex-material-choice ex-material-${material} ${designSpec.materialStyle.material === material ? 'is-selected' : ''}`}
                      onClick={() => setDesignSpec(current => ({
                        ...current, materialStyle: material === 'midnight'
                          ? { material, style: 'Midnight frame' }
                          : material === 'walnut'
                            ? { material, style: 'Warm walnut' }
                            : { material, style: 'Brushed brass' },
                      }))}
                      aria-pressed={designSpec.materialStyle.material === material}
                      title={material === 'midnight' ? 'Midnight frame' : material === 'walnut' ? 'Warm walnut' : 'Brushed brass'}
                      aria-label={material === 'midnight' ? 'Midnight frame' : material === 'walnut' ? 'Warm walnut' : 'Brushed brass'}>
                      <span/>
                    </button>
                  ))}
                </div>
              </div>

              <button className="ex-generate" type="button" disabled={isBuilding}
                onClick={() => void buildFrame()}>
                <span>{isBuilding ? 'Mapping your sky…' : built ? 'Recalculate this night' : 'Generate my keepsake'}</span>
                <span aria-hidden="true">{isBuilding ? '◌' : '↗'}</span>
              </button>
              {error && <p className="ex-error" role="alert">{error}</p>}
              <p className="ex-privacy">Preview stays in your browser. No purchase or order is placed.</p>
            </div>
          </div>

          <div className="ex-stage">
            <div className="ex-stage-topline"><span>STUDIO / LIVE ARTWORK</span><span>↗ INTERACTIVE PREVIEW</span></div>
            <div className={`ex-stage-art ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={event => { event.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onFileDrop}>
              <div className="ex-stage-constellation" aria-hidden="true">
                <span/><span/><span/><span/><span/>
              </div>
              <div className="ex-frame-holder">
                <StarKeepsakePreview
                  designSpec={displayDesignSpec}
                  photoPreview={photoUrl}
                  engravingPreview=""
                  isProcessingPhoto={false}
                  blendPreview=""
                  skyPlacement={composition}
                  withinCutoutUrl={cutoutUrl}
                  photoFitMode={photoFitMode}
                  minimal
                  ready={built}
                  onPhotoAreaClick={() => selectEditor('photo')}
                  onSkyAreaClick={() => selectEditor('moment')}
                />
              </div>
              {!isBuilding && !built && <p className="ex-frame-hint">
                <span>↖</span> Hover the photo or stars to make them yours.
              </p>}
              {isBuilding && <BuildAnimation progress={buildProgress}/>}
              {isDragging && <div className="ex-drop-cover" aria-hidden="true">Release to add your photograph</div>}
            </div>
            <div className="ex-stage-footer">
              <span>✦ STARKEEP / OBSERVATION SERIES</span>
              <span>{built ? `${designSpec.stars.length} CALCULATED STARS` : 'AWAITING YOUR MOMENT'}</span>
            </div>
            {built && <div className="ex-built-caption" role="status">
              <span className="ex-built-icon">✧</span>
              <div><strong>Your night, reconstructed.</strong>
                <p>Calculated from your selected place and time using the Hipparcos star catalog.</p></div>
            </div>}
          </div>
        </section>

        {built && <section className="ex-observatory" aria-label="Explore the interactive night sky">
          <div className="ex-observatory-intro">
            <div>
              <p className="ex-eyebrow">BEYOND THE FRAME / OBSERVATORY</p>
              <h2>Explore the sky behind your story.</h2>
              <p>Turn the viewpoint and discover calculated stars above your location—right here on the same page.</p>
            </div>
            <button type="button" className="ex-observatory-button"
              aria-expanded={showObservatory}
              onClick={() => setShowObservatory(value => !value)}>
              {showObservatory ? 'Close observatory' : 'Explore interactive sky'} <span aria-hidden="true">↗</span>
            </button>
          </div>
          {showObservatory && explorerResult && explorerLocation &&
            <div className="ex-observatory-content">
              <SkyImmersiveView result={explorerResult} location={explorerLocation}/>
            </div>}
        </section>}

        <section id="science" className="ex-science" aria-label="How the stars are calculated">
          <div className="ex-science-heading">
            <span className="ex-eyebrow">GROUND TRUTH / CELESTIAL DATA</span>
            <h2>Not imagined.<br/><em>Calculated.</em></h2>
          </div>
          <div className="ex-science-grid">
            <article><span>01 / PLACE</span><strong>Your coordinates</strong>
              <p>We resolve the location and its time zone to place an observer on Earth.</p></article>
            <article><span>02 / TIME</span><strong>Your exact moment</strong>
              <p>Skyfield calculates the star field for the date and local time you choose.</p></article>
            <article><span>03 / STARS</span><strong>Real catalog positions</strong>
              <p>A curated sample of Hipparcos stars forms your personalized preview.</p></article>
          </div>
          <p className="ex-science-note">Star positions use ESA's Hipparcos catalogue, Skyfield and a JPL ephemeris.
            Material and lighting previews are illustrative. StarKeepsake is independent and is not affiliated with NASA or ESA.
            <a href="https://www.esa.int/Science_Exploration/Space_Science/Hipparcos_overview"
              target="_blank" rel="noopener noreferrer">About Hipparcos ↗</a>
          </p>
        </section>
      </main>
      <footer className="ex-footer"><span>✳ STARKEEP SAKE</span>
        <span>A little piece of forever.</span><span>© {new Date().getFullYear()} STARKEEP SAKE · PREVIEW STUDIO</span></footer>
      {cutoutEditorMounted && photoFile &&
        <div hidden={!cutoutEditorOpen}>
          <SkyCutoutPreview key={photoUrl} file={photoFile}
            active={cutoutEditorOpen} onApply={applyCutout}
            onCancel={() => setCutoutEditorOpen(false)}/>
        </div>}
      <input ref={fileInputRef} className="ex-visually-hidden" type="file"
        accept="image/jpeg,image/png,image/webp" aria-label="Choose an image"
        onChange={event => {
          receivePhoto(event.target.files?.[0])
          event.target.value = ''
        }}/>
    </div>
  )
}
