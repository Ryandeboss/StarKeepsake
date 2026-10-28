import type { ChangeEvent } from 'react'
import type { DesignSpec, MaterialStyleSpec } from '../designSpec'

type ConfiguratorFormProps = {
  designSpec: DesignSpec
  photoFile: File | null
  activeStep: number
  onMomentChange: <K extends keyof DesignSpec['moment']>(field: K, value: DesignSpec['moment'][K]) => void
  onCustomTextChange: (value: string) => void
  onMaterialStyleChange: (materialStyle: MaterialStyleSpec) => void
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBack: () => void
  onNext: () => void
  onFinish: () => void
}

const frameOptions: MaterialStyleSpec[] = [
  { material: 'midnight', style: 'Midnight frame' },
  { material: 'walnut', style: 'Warm walnut' },
  { material: 'brass', style: 'Brushed brass' },
]

export function ConfiguratorForm({
  designSpec,
  photoFile,
  activeStep,
  onMomentChange,
  onCustomTextChange,
  onMaterialStyleChange,
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
                  <strong>{photoFile ? photoFile.name : 'Choose a photo'}</strong>
                  <span>{photoFile ? 'Ready for your preview' : 'JPG, PNG, or HEIC · up to 10 MB'}</span>
                </span>
              </label>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="date">Date</label>
                <input className="text-input" id="date" type="date" value={designSpec.moment.date} onChange={(event) => onMomentChange('date', event.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="time">Time <span className="field-hint">(optional)</span></label>
                <input className="text-input" id="time" type="time" value={designSpec.moment.time} disabled={designSpec.moment.exactTimeUnknown} onChange={(event) => onMomentChange('time', event.target.value)} />
              </div>
            </div>
            <label className="toggle-row" htmlFor="unknown-time">
              <span>Exact time unknown</span>
              <span className="toggle-control">
                <input id="unknown-time" type="checkbox" checked={designSpec.moment.exactTimeUnknown} onChange={(event) => onMomentChange('exactTimeUnknown', event.target.checked)} />
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
              <input className="text-input" id="names" type="text" maxLength={48} placeholder="Avery & Jordan" value={designSpec.customText.value} onChange={(event) => onCustomTextChange(event.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="location">Where were you?</label>
              <input className="text-input" id="location" type="text" maxLength={48} placeholder="Joshua Tree, California" value={designSpec.moment.location} onChange={(event) => onMomentChange('location', event.target.value)} />
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
                    className={`style-option ${designSpec.materialStyle.material === option.material ? 'is-selected' : ''}`}
                    key={option.material}
                    type="button"
                    role="radio"
                    aria-checked={designSpec.materialStyle.material === option.material}
                    onClick={() => onMaterialStyleChange(option)}
                  >
                    <span className={`style-swatch ${option.material}`} aria-hidden="true" />
                    <strong>{option.style}</strong>
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
