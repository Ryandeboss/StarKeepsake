import type { ChangeEvent } from 'react'
import type { ConfiguratorState, FrameStyle } from '../types'

type ConfiguratorFormProps = {
  form: ConfiguratorState
  activeStep: number
  onChange: <K extends keyof ConfiguratorState>(field: K, value: ConfiguratorState[K]) => void
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBack: () => void
  onNext: () => void
  onFinish: () => void
}

const frameOptions: Array<{ name: FrameStyle; className: string }> = [
  { name: 'Midnight frame', className: 'midnight' },
  { name: 'Warm walnut', className: 'walnut' },
  { name: 'Brushed brass', className: 'brass' },
]

export function ConfiguratorForm({
  form,
  activeStep,
  onChange,
  onPhotoChange,
  onBack,
  onNext,
  onFinish,
}: ConfiguratorFormProps) {
  return (
    <form className="configurator-card" onSubmit={(event) => event.preventDefault()}>
      {activeStep === 0 && (
        <>
          <div className="step-heading">
            <p className="step-kicker">Step 01 / The moment</p>
            <h2>Start with the memory.</h2>
            <p>Give us the details that make this night yours.</p>
          </div>
          <div className="step-fields">
            <div className="field">
              <label className="field-label" htmlFor="photo">A photo to remember</label>
              <label className="photo-dropzone" htmlFor="photo">
                <input id="photo" type="file" accept="image/*" onChange={onPhotoChange} />
                <span className="photo-dropzone-content">
                  <span className="photo-icon" aria-hidden="true">+</span>
                  <strong>{form.photoFile ? form.photoFile.name : 'Choose a photo'}</strong>
                  <span>{form.photoFile ? 'Ready for your preview' : 'JPG, PNG, or HEIC · up to 10 MB'}</span>
                </span>
              </label>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="date">Date</label>
                <input className="text-input" id="date" type="date" value={form.date} onChange={(event) => onChange('date', event.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="time">Time <span className="field-hint">(optional)</span></label>
                <input className="text-input" id="time" type="time" value={form.time} disabled={form.exactTimeUnknown} onChange={(event) => onChange('time', event.target.value)} />
              </div>
            </div>
            <label className="toggle-row" htmlFor="unknown-time">
              <span>Exact time unknown</span>
              <span className="toggle-control">
                <input id="unknown-time" type="checkbox" checked={form.exactTimeUnknown} onChange={(event) => onChange('exactTimeUnknown', event.target.checked)} />
                <span className="toggle-track" aria-hidden="true" />
              </span>
            </label>
          </div>
        </>
      )}

      {activeStep === 1 && (
        <>
          <div className="step-heading">
            <p className="step-kicker">Step 02 / The story</p>
            <h2>Make it unmistakably yours.</h2>
            <p>These words will live beneath your little piece of sky.</p>
          </div>
          <div className="step-fields">
            <div className="field">
              <label className="field-label" htmlFor="names">Names or custom text</label>
              <input className="text-input" id="names" type="text" maxLength={48} placeholder="Avery & Jordan" value={form.names} onChange={(event) => onChange('names', event.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="location">Where were you?</label>
              <input className="text-input" id="location" type="text" maxLength={48} placeholder="Joshua Tree, California" value={form.location} onChange={(event) => onChange('location', event.target.value)} />
            </div>
            <p className="field-hint">Location can be a city, a venue, or simply “home.”</p>
          </div>
        </>
      )}

      {activeStep === 2 && (
        <>
          <div className="step-heading">
            <p className="step-kicker">Step 03 / The object</p>
            <h2>Choose its forever frame.</h2>
            <p>A material direction for your keepsake. You can refine it later.</p>
          </div>
          <div className="step-fields">
            <div className="field">
              <span className="field-label" id="frame-style-label">Material and style</span>
              <div className="style-grid" role="radiogroup" aria-labelledby="frame-style-label">
                {frameOptions.map((option) => (
                  <button
                    className={`style-option ${form.frameStyle === option.name ? 'is-selected' : ''}`}
                    key={option.name}
                    type="button"
                    role="radio"
                    aria-checked={form.frameStyle === option.name}
                    onClick={() => onChange('frameStyle', option.name)}
                  >
                    <span className={`style-swatch ${option.className}`} aria-hidden="true" />
                    <strong>{option.name}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="toggle-row">
              <span>Keep the design understated</span>
              <span className="field-hint">Placeholder preference</span>
            </div>
          </div>
        </>
      )}

      <div className="step-navigation">
        {activeStep > 0 ? <button className="button-secondary" type="button" onClick={onBack}>Back</button> : <span />}
        {activeStep < 2 ? (
          <button className="button-primary" type="button" onClick={onNext}>Next step <span aria-hidden="true">→</span></button>
        ) : (
          <button className="button-primary" type="button" onClick={onFinish}>Preview ready <span aria-hidden="true">✦</span></button>
        )}
      </div>
    </form>
  )
}
