import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { displayRectStyle, millimetersToPixels, pointToDisplayPixels, rectToDisplayPixels } from '../geometry'
import type { DesignSpec } from '../designSpec'

type StarKeepsakePreviewProps = {
  designSpec: DesignSpec
  photoPreview: string
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

export function StarKeepsakePreview({ designSpec, photoPreview }: StarKeepsakePreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [lightsOn, setLightsOn] = useState(true)
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
  const centerPoint = pointToDisplayPixels(
    { xMm: physicalArtwork.widthMm / 2, yMm: physicalArtwork.heightMm / 2 },
    displayWidthPx,
    physicalArtwork.widthMm,
  )
  const displaySkyRect = rectToDisplayPixels(regions.sky, displayWidthPx, physicalArtwork.widthMm)
  const displayTextStyle = {
    ...displayRectStyle(textRect),
    textAlign: designSpec.customText.align,
  } as CSSProperties

  return (
    <aside className="preview-card" aria-label="Live StarKeepsake preview">
      <div className="preview-topline">
        <span>StarKeepsake / preview</span>
        <span className="preview-live">Live preview</span>
      </div>

      <div className="frame-preview">
        <div
          className={`artwork-canvas ${lightsOn ? '' : 'is-dimmed'}`}
          ref={canvasRef}
          data-physical-center="139.7mm,177.8mm"
          data-coordinate-system="top-left-origin-mm"
        >
          <div className="artwork-stars" aria-hidden="true" style={displayRectStyle(displaySkyRect)}>
            {designSpec.stars.map((star) => {
              const point = pointToDisplayPixels(star, displayWidthPx, physicalArtwork.widthMm)
              const size = millimetersToPixels(star.holeSizeMm, displayWidthPx, physicalArtwork.widthMm)
              const style = {
                left: point.x,
                top: point.y,
                width: size,
                height: size,
                opacity: Math.max(0.4, 1 - star.magnitude * 0.14),
              } as CSSProperties

              return <span className="artwork-star" key={star.ledIndex} style={style} data-led-index={star.ledIndex} />
            })}
          </div>

          <div className="artwork-center-mark" aria-hidden="true" style={{ left: centerPoint.x, top: centerPoint.y }} />

          <div className="photo-engraving" style={displayRectStyle(photoRect)}>
            {photoPreview ? (
              <img src={photoPreview} alt="Selected photo for the keepsake" />
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
              {formatDate(designSpec.moment.date)} · {designSpec.moment.exactTimeUnknown ? 'Time gently held' : designSpec.moment.time || 'Your special time'}
            </span>
            <small className="artwork-location">{designSpec.moment.location || 'A place worth remembering'}</small>
          </div>
        </div>
      </div>

      <div className="preview-controls">
        <span>{designSpec.materialStyle.style}</span>
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
    </aside>
  )
}
