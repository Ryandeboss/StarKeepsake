import { useRef } from 'react'
import type { PointerEvent } from 'react'
import type { PhotoCrop } from '../designSpec'
import { clampCrop, croppedImageStyle, FULL_PHOTO_CROP, getCoverCrop } from '../photoCrop'

type Dimensions = { width: number; height: number }
type Props = {
  photoUrl: string
  aspect: number
  crop: PhotoCrop
  fitMode: 'contain' | 'cover'
  dimensions: Dimensions | null
  onDimensions: (value: Dimensions) => void
  onCrop: (value: PhotoCrop) => void
  onFitMode: (mode: 'contain' | 'cover', crop: PhotoCrop) => void
}

export function PhotoCropEditor({
  photoUrl, aspect, crop, fitMode, dimensions,
  onDimensions, onCrop, onFitMode,
}: Props) {
  const drag = useRef<{ x: number; y: number; crop: PhotoCrop } | null>(null)
  const base = dimensions ? getCoverCrop(dimensions.width, dimensions.height, aspect) : FULL_PHOTO_CROP
  const zoom = fitMode === 'cover' ? Math.max(1, base.width / crop.width) : 1

  const zoomTo = (nextZoom: number) => {
    const width = base.width / nextZoom
    const height = base.height / nextZoom
    onCrop(clampCrop({
      x: crop.x + (crop.width - width) / 2,
      y: crop.y + (crop.height - height) / 2,
      width, height,
    }))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (fitMode !== 'cover') return
    drag.current = { x: event.clientX, y: event.clientY, crop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const starting = drag.current
    if (!starting || fitMode !== 'cover') return
    const width = event.currentTarget.clientWidth
    const height = event.currentTarget.clientHeight
    onCrop(clampCrop({
      ...starting.crop,
      x: starting.crop.x - (event.clientX - starting.x) / width * starting.crop.width,
      y: starting.crop.y - (event.clientY - starting.y) / height * starting.crop.height,
    }))
  }

  return (
    <div className="photo-crop-editor">
      <span className="field-label">Photo placement</span>
      <div className="photo-fit-options" role="group" aria-label="Photo fitting">
        <button className={fitMode === 'contain' ? 'is-selected' : ''} type="button"
          onClick={() => onFitMode('contain', FULL_PHOTO_CROP)}>
          Show whole photo
        </button>
        <button className={fitMode === 'cover' ? 'is-selected' : ''} type="button"
          disabled={!dimensions}
          onClick={() => onFitMode('cover', base)}>
          Fill area / crop
        </button>
      </div>
      <div className={`photo-crop-stage ${fitMode === 'cover' ? 'can-drag' : ''}`}
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        aria-label="Photo crop preview; drag to reposition in fill mode"
      >
        <img src={photoUrl} alt="Adjust your photo before engraving"
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (!dimensions || naturalWidth !== dimensions.width || naturalHeight !== dimensions.height) {
              onDimensions({ width: naturalWidth, height: naturalHeight })
            }
          }}
          style={fitMode === 'contain'
            ? { width: '100%', height: '100%', objectFit: 'contain' }
            : croppedImageStyle(crop)}
        />
      </div>
      {fitMode === 'cover' && (
        <label className="crop-zoom-control">
          <span>Zoom · {zoom.toFixed(1)}×</span>
          <input type="range" min="1" max="3" step="0.05"
            value={Math.min(3, zoom)}
            onChange={(event) => zoomTo(Number(event.target.value))}
            aria-label="Photo crop zoom"
          />
          <small>Drag the photo to choose what stays in the frame.</small>
        </label>
      )}
      <p className="field-hint">“Show whole photo” keeps everything visible and may add a light border. “Fill area” crops to the frame’s photo shape.</p>
    </div>
  )
}
