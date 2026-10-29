import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { displayRectStyle, millimetersToPixels, pointToDisplayPixels, rectToDisplayPixels } from '../geometry'
import type { DesignSpec } from '../designSpec'
import { croppedImageStyle } from '../photoCrop'

type StarKeepsakePreviewProps = {
  designSpec: DesignSpec
  photoPreview: string
  engravingPreview: string
  isProcessingPhoto: boolean
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

export function StarKeepsakePreview({ designSpec, photoPreview, engravingPreview, isProcessingPhoto }: StarKeepsakePreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [lightsOn, setLightsOn] = useState(true)
  const [showEngraving, setShowEngraving] = useState(true)
  const [displayWidthPx, setDisplayWidthPx] = useState(0)
  const { physicalArtwork, regions } = designSpec

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
  const displayTextStyle = {
    ...displayRectStyle(textRect),
    textAlign: designSpec.customText.align,
  } as CSSProperties

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
        aria-label={`Physical frame mockup in ${designSpec.materialStyle.style}`}
      >
        <div
          className={`artwork-canvas ${lightsOn ? '' : 'is-dimmed'}`}
          ref={canvasRef}
          style={{ aspectRatio: `${physicalArtwork.widthMm} / ${physicalArtwork.heightMm}` }}
          data-frame-size={designSpec.framePresetId}
          data-coordinate-system="top-left-origin-mm"
        >
          <div className="artwork-stars" aria-hidden="true" style={displayRectStyle(displaySkyRect)}>
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
        <span>{designSpec.framePresetId.replace('x', ' × ')} in · {designSpec.materialStyle.style}</span>
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
      {photoPreview && (
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
