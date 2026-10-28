import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { ConfiguratorState } from '../types'

type StarKeepsakePreviewProps = {
  form: ConfiguratorState
}

const stars = [
  [9, 16, 2, 0.8], [20, 31, 1, 0.65], [32, 11, 2, 0.9], [44, 22, 1, 0.75],
  [57, 9, 1, 0.6], [67, 29, 2, 0.85], [82, 21, 1, 0.9], [90, 40, 2, 0.7],
  [14, 52, 1, 0.7], [25, 67, 2, 0.8], [39, 57, 1, 0.65], [51, 78, 2, 0.9],
  [64, 62, 1, 0.7], [76, 83, 1, 0.8], [88, 72, 2, 0.85], [94, 55, 1, 0.65],
]

function formatDate(date: string) {
  if (!date) return 'Your special date'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function StarKeepsakePreview({ form }: StarKeepsakePreviewProps) {
  const [lightsOn, setLightsOn] = useState(true)
  const displayTime = form.exactTimeUnknown ? 'Time gently held' : form.time || 'Your special time'

  return (
    <aside className="preview-card" aria-label="Live StarKeepsake preview">
      <div className="preview-topline">
        <span>StarKeepsake / preview</span>
        <span className="preview-live">Live preview</span>
      </div>

      <div className="frame-preview">
        <div className={`artwork-canvas ${lightsOn ? '' : 'is-dimmed'}`}>
          <div className="artwork-stars" aria-hidden="true">
            {stars.map(([left, top, size, opacity], index) => {
              const style = {
                left: `${left}%`,
                top: `${top}%`,
                width: `${size + 1}px`,
                height: `${size + 1}px`,
                opacity,
              } as CSSProperties

              return <span className="artwork-star" key={index} style={style} />
            })}
          </div>
          <div className="artwork-constellation" aria-hidden="true" />

          <div className="artwork-content">
            <div className="photo-engraving">
              {form.photoPreview ? (
                <img src={form.photoPreview} alt="Selected photo for the keepsake" />
              ) : (
                <div className="photo-empty">
                  <strong>Your photo</strong>
                  <span>Engraved memory area</span>
                </div>
              )}
            </div>
            <div className="artwork-copy">
              <strong>{form.names || 'Your names here'}</strong>
              <span>{formatDate(form.date)} · {displayTime}</span>
              <small className="artwork-location">{form.location || 'A place worth remembering'}</small>
            </div>
          </div>
        </div>
      </div>

      <div className="preview-controls">
        <span>{form.frameStyle}</span>
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
