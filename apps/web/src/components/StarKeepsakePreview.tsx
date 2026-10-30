import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { displayRectStyle, millimetersToPixels, pointToDisplayPixels, rectToDisplayPixels } from '../geometry'
import type { DesignSpec } from '../designSpec'
import { croppedImageStyle } from '../photoCrop'
import { getStarContext, starCatalogUrl, starCompassDirection, starDescription, starDisplayName } from '../starDetails'

type StarKeepsakePreviewProps = {
  designSpec: DesignSpec
  photoPreview: string
  engravingPreview: string
  isProcessingPhoto: boolean
  blendPreview: string
}

function formatDate(date: string) {
  if (!date) return 'Your special date'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function StarKeepsakePreview({ designSpec, photoPreview, engravingPreview, isProcessingPhoto, blendPreview }: StarKeepsakePreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [lightsOn, setLightsOn] = useState(true)
  const [showEngraving, setShowEngraving] = useState(true)
  // Stars are inspectable as soon as a real sky is calculated. A separate
  // display toggle remains available for customers who want a clean mockup.
  const [exploreStars, setExploreStars] = useState(true)
  const [hoveredStarId, setHoveredStarId] = useState<number | null>(null)
  const [pinnedStarId, setPinnedStarId] = useState<number | null>(null)
  const [displayWidthPx, setDisplayWidthPx] = useState(0)
  const { physicalArtwork, regions } = designSpec
  const activeStarId = hoveredStarId ?? pinnedStarId
  const activeStar = designSpec.stars.find((star) => star.hipparcosId === activeStarId)
  const activeStarTooltipPosition = activeStar ? (() => {
    const starX = millimetersToPixels(activeStar.xMm, displayWidthPx, physicalArtwork.widthMm)
    const starY = millimetersToPixels(activeStar.yMm, displayWidthPx, physicalArtwork.widthMm)
    const tooltipWidth = Math.min(188, Math.max(80, displayWidthPx - 16))
    const proposedX = starX > displayWidthPx / 2 ? starX - tooltipWidth - 10 : starX + 10
    const skyBottom = millimetersToPixels(
      regions.sky.yMm + regions.sky.heightMm, displayWidthPx, physicalArtwork.widthMm,
    )
    return {
      width: tooltipWidth,
      left: Math.max(6, Math.min(proposedX, displayWidthPx - tooltipWidth - 6)),
      top: Math.max(6, Math.min(starY + 8, skyBottom - 74)),
    } as CSSProperties
  })() : undefined

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateDisplaySize = () => setDisplayWidthPx(canvas.getBoundingClientRect().width)
    updateDisplaySize()

    const observer = new ResizeObserver(updateDisplaySize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const photoRect = rectToDisplayPixels(designSpec.photo.positionMm, displayWidthPx, physicalArtwork.widthMm)
  const textRect = rectToDisplayPixels(designSpec.customText.positionMm, displayWidthPx, physicalArtwork.widthMm)
  const displaySkyRect = rectToDisplayPixels(regions.sky, displayWidthPx, physicalArtwork.widthMm)
  const blendDisplayRect = rectToDisplayPixels({
    xMm: regions.sky.xMm,
    yMm: regions.sky.yMm,
    widthMm: regions.sky.widthMm,
    heightMm: regions.engravingPhoto.yMm + regions.engravingPhoto.heightMm - regions.sky.yMm,
  }, displayWidthPx, physicalArtwork.widthMm)
  const displayTextStyle = {
    ...displayRectStyle(textRect),
    textAlign: designSpec.customText.align,
  } as CSSProperties

  const physicalWidthInches = physicalArtwork.widthMm / 25.4
  const physicalHeightInches = physicalArtwork.heightMm / 25.4
  const previewScalePercent = Math.max(38, Math.min(100, 100 * physicalArtwork.widthMm / 406.4))

  return (
    <aside className="preview-card" aria-label="Live StarKeepsake preview">
      <div className="preview-topline">
        <span>StarKeepsake / preview</span>
        <span className="preview-live">
          {designSpec.astronomy ? `${designSpec.stars.length} real stars` : 'Waiting for your sky'}
        </span>
      </div>

      <div
        className={`frame-preview frame-preview--${designSpec.materialStyle.material}`}
        style={{ width: `${previewScalePercent}%`, marginInline: 'auto' }}
        aria-label={`Physical frame mockup in ${designSpec.materialStyle.style}`}
      >
        <div
          className={`artwork-canvas ${lightsOn ? '' : 'is-dimmed'}`}
          ref={canvasRef}
          style={{ aspectRatio: `${physicalArtwork.widthMm} / ${physicalArtwork.heightMm}` }}
          data-frame-size={designSpec.framePresetId}
          data-coordinate-system="top-left-origin-mm"
        >
          {designSpec.layoutMode === 'classic' ? (
            <>
          <div className="artwork-stars" aria-hidden={!exploreStars} style={displayRectStyle(displaySkyRect)}>
            {designSpec.stars.map((star) => {
              // The engine outputs canonical artwork coordinates; absolute
              // children of the sky panel need sky-local display coordinates.
              const point = pointToDisplayPixels(
                { xMm: star.xMm - regions.sky.xMm, yMm: star.yMm - regions.sky.yMm },
                displayWidthPx,
                physicalArtwork.widthMm,
              )
              const size = millimetersToPixels(star.holeSizeMm, displayWidthPx, physicalArtwork.widthMm)
              const style = {
                left: point.x,
                top: point.y,
                width: size,
                height: size,
                opacity: Math.max(0.4, 1 - star.magnitude * 0.14),
              } as CSSProperties

              if (exploreStars) {
                return (
                  <button
                    type="button"
                    className="star-hit-target"
                    key={star.hipparcosId}
                    style={{ left: point.x, top: point.y }}
                    title={starDescription(star)}
                    aria-label={starDescription(star)}
                    data-hipparcos-id={star.hipparcosId}
                    onPointerEnter={() => setHoveredStarId(star.hipparcosId)}
                    onPointerLeave={() => setHoveredStarId(null)}
                    onFocus={() => setHoveredStarId(star.hipparcosId)}
                    onBlur={() => setHoveredStarId(null)}
                    aria-pressed={pinnedStarId === star.hipparcosId}
                    onClick={() => setPinnedStarId((current) =>
                      current === star.hipparcosId ? null : star.hipparcosId)}
                  >
                    <span className="artwork-star" aria-hidden="true" style={{
                      left: '50%', top: '50%', width: size, height: size,
                      opacity: style.opacity,
                    }} />
                  </button>
                )
              }

              return (
                <span
                  className="artwork-star"
                  key={star.hipparcosId}
                  style={style}
                  data-led-index={star.ledIndex}
                  data-hipparcos-id={star.hipparcosId}
                />
              )
            })}
          </div>

          <div
            className="photo-engraving"
            data-photo-fit={designSpec.photo.fitMode}
            style={displayRectStyle(photoRect)}
          >
            {engravingPreview && showEngraving ? (
              <img
                src={engravingPreview}
                className="is-engraved"
                alt="Processed engraving preview of the full photo or selected crop"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
              />
            ) : photoPreview ? (
              <img
                src={photoPreview}
                alt={designSpec.photo.fitMode === 'contain'
                  ? 'Entire original photo fitted inside the panel'
                  : 'Original photo showing the selected crop'}
                style={designSpec.photo.fitMode === 'contain'
                  ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }
                  : croppedImageStyle(designSpec.photo.crop)}
              />
            ) : (
              <div className="photo-empty">
                <strong>Your photo</strong>
                <span>Engraved memory area</span>
              </div>
            )}
          </div>
            </>
          ) : (
            <div className="horizon-blend-scene" style={displayRectStyle(blendDisplayRect)}>
              {blendPreview ? (
                <img
                  src={blendPreview}
                  alt="AI sky-mask artistic preview, with calculated stars blended into detected open sky"
                  style={designSpec.photo.fitMode === 'contain'
                    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }
                    : croppedImageStyle(designSpec.photo.crop)}
                />
              ) : photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Original photo before optional sky detection"
                  style={designSpec.photo.fitMode === 'contain'
                    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }
                    : croppedImageStyle(designSpec.photo.crop)}
                />
              ) : (
                <div className="horizon-placeholder">
                  <strong>A scene beneath your stars</strong>
                  <span>Choose an outdoor photo with visible sky</span>
                </div>
              )}
              <span className="horizon-blend-watermark">
                {blendPreview ? 'Artistic sky blend · not camera-aligned' : 'Horizon Blend · preview'}
              </span>
            </div>
          )}

          {designSpec.layoutMode === 'classic' && exploreStars && activeStar && (
            <div className="frame-star-tooltip" style={activeStarTooltipPosition} role="status">
              <strong>{starDisplayName(activeStar)}</strong>
              <small>HIP {activeStar.hipparcosId} · {activeStar.magnitude.toFixed(2)} mag</small>
              <small>{activeStar.altitudeDeg.toFixed(1)}° above horizon · {starCompassDirection(activeStar.azimuthDeg)}</small>
            </div>
          )}

          <div className="artwork-copy" style={displayTextStyle}>
            <strong>{designSpec.customText.value || 'Your names here'}</strong>
            <span>
              {formatDate(designSpec.moment.date)} · {designSpec.moment.exactTimeUnknown ? 'Exact time unknown' : designSpec.moment.time || 'Your special time'}
            </span>
            <small className="artwork-location">
              {designSpec.moment.location?.displayName || 'A place worth remembering'}
            </small>
          </div>
        </div>
      </div>

      <div className="preview-controls">
        <span>{designSpec.framePresetId === 'auto' ? 'Custom photo fit' : designSpec.framePresetId.replace('x', ' × ')} · {physicalWidthInches.toFixed(1)} × {physicalHeightInches.toFixed(1)} in · {designSpec.materialStyle.style}</span>
        <label className="preview-toggle">
          <span>{lightsOn ? 'Lights on' : 'Lights off'}</span>
          <input
            type="checkbox"
            checked={lightsOn}
            onChange={(event) => setLightsOn(event.target.checked)}
            aria-label="Toggle preview lights"
          />
          <span className="preview-toggle-track" aria-hidden="true" />
        </label>
      </div>
      {photoPreview && designSpec.layoutMode === 'classic' && (
        <div className="preview-photo-modes" role="group" aria-label="Photo rendering preview">
          <button type="button" className={!showEngraving ? 'is-selected' : ''}
            aria-pressed={!showEngraving} onClick={() => setShowEngraving(false)}>
            Original photograph
          </button>
          <button type="button" className={showEngraving ? 'is-selected' : ''}
            aria-pressed={showEngraving} onClick={() => setShowEngraving(true)}>
            Engraving simulation
          </button>
        </div>
      )}
      <section className="sky-evidence" aria-label="Astronomy provenance and star explorer">
        <div className="sky-evidence-heading">
          <div>
            <strong>Measured stars, calculated sky</strong>
            <span>Hipparcos catalogue · Skyfield · JPL DE440s</span>
          </div>
          <button type="button" className="sky-explore-button"
            disabled={designSpec.layoutMode !== 'classic' || !designSpec.astronomy || designSpec.stars.length === 0}
            aria-pressed={exploreStars}
            onClick={() => {
              setExploreStars(!exploreStars)
              setHoveredStarId(null)
              setPinnedStarId(null)
            }}
          >
            {exploreStars ? 'Hide star details' : 'Explore real stars'}
          </button>
        </div>
        {exploreStars && designSpec.layoutMode === 'classic' && (
          <p className="sky-interaction-hint">
            {designSpec.stars.length
              ? 'Hover any plotted star for an instant label. Click or tap a star to pin its details and verification link below.'
              : 'Choose a location and moment to calculate your real star field.'}
          </p>
        )}
        {exploreStars && designSpec.layoutMode === 'classic' && activeStar && (
          <div className="star-information" role="status">
            <strong>{starDisplayName(activeStar)}</strong>
            <span>HIP {activeStar.hipparcosId} · apparent magnitude {activeStar.magnitude.toFixed(2)}</span>
            <span>Altitude {activeStar.altitudeDeg.toFixed(1)}° above the ideal horizon</span>
            <span>Azimuth {activeStar.azimuthDeg.toFixed(1)}° · {starCompassDirection(activeStar.azimuthDeg)}</span>
            <span>{getStarContext(activeStar).summary}</span>
            <a href={starCatalogUrl(activeStar)} target="_blank" rel="noopener noreferrer">
              Verify this HIP star in CDS SIMBAD
            </a>
          </div>
        )}
        <a className="sky-lab-launch" href="/sky-lab" target="_blank" rel="noopener noreferrer">
          Explore the 3D Earth & interactive night sky <span aria-hidden="true">↗</span>
        </a>
        <details className="sky-method-details">
          <summary>How is my sky calculated?</summary>
          <p>Star positions come from the European Space Agency's Hipparcos catalogue. Skyfield uses your chosen location and time with the JPL DE440s ephemeris to compute apparent star altitude and azimuth.</p>
          <p>The artwork is an altitude/azimuth map with north in the center and the horizon along the bottom. It is not a photographic view or a measured local landscape horizon.</p>
          {designSpec.astronomy && (
            <p><strong>Time basis:</strong> {designSpec.astronomy.timeBasis === 'exact'
              ? 'Exact local time resolved to UTC.'
              : 'Exact time unknown: uses local midnight as a representative sky, not an exact historical view.'}</p>
          )}
          <div className="sky-source-links">
            <a href="https://www.esa.int/Science_Exploration/Space_Science/Hipparcos_overview" target="_blank" rel="noopener noreferrer">ESA: Hipparcos catalogue</a>
            <a href="https://rhodesmill.org/skyfield/positions.html" target="_blank" rel="noopener noreferrer">Skyfield: celestial positions</a>
            <a href="https://rhodesmill.org/skyfield/planets.html" target="_blank" rel="noopener noreferrer">JPL ephemerides explained</a>
          </div>
        </details>
      </section>
      {designSpec.layoutMode === 'horizon-blend' && (
        <p className="blend-disclaimer">
          Experimental artistic overlay: a semantic AI model identifies likely photo sky. The Hipparcos stars are genuine,
          but photo heading, field of view, sky visibility and engravability are not verified. No star placements
          are approved for manufacturing in this mode.
        </p>
      )}
      <p className="preview-physical-note">
        Material and lighting are illustrative. Confirm wood profile, glazing, and finish against your production sample.
      </p>
      {isProcessingPhoto && <p className="preview-engraving-note" role="status">Preparing your engraving preview…</p>}
      {engravingPreview && (
        <p className="preview-engraving-note">
          <a href={engravingPreview} download="engraving-preview.png">Save grayscale engraving preview (PNG)</a>
          <span> · Visual preview only, not a laser-ready file.</span>
        </p>
      )}
    </aside>
  )
}
