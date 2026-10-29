import type { ChangeEvent } from 'react'
import type { LocationCandidate } from '../api'
import { FRAME_PRESETS } from '../designSpec'
import type { DesignSpec, MaterialStyleSpec, FramePresetId, PhotoCrop } from '../designSpec'
import { PhotoCropEditor } from './PhotoCropEditor'

type MomentInputField = 'date' | 'time' | 'exactTimeUnknown'

type ConfiguratorFormProps = {
  designSpec: DesignSpec
  photoFile: File | null
  photoUrl: string
  sourceDimensions: { width: number; height: number } | null
  onSourceDimensions: (size: { width: number; height: number }) => void
  onPhotoCrop: (crop: PhotoCrop) => void
  onPhotoFit: (mode: 'contain' | 'cover', crop: PhotoCrop) => void
  onFrameChange: (id: FramePresetId) => void
  onLayoutModeChange: (mode: DesignSpec['layoutMode']) => void
  onDetectSky: () => void
  isDetectingSky: boolean
  blendStatus: string
  blendReady: boolean
  photoError: string
  isProcessingPhoto: boolean
  photoIsEngraved: boolean
  activeStep: number
  locationQuery: string
  locationCandidates: LocationCandidate[]
  selectedLocation: LocationCandidate | null
  isSearchingLocation: boolean
  isResolvingMoment: boolean
  formError: string
  onMomentChange: <K extends MomentInputField>(field: K, value: DesignSpec['moment'][K]) => void
  onCustomTextChange: (value: string) => void
  onMaterialStyleChange: (materialStyle: MaterialStyleSpec) => void
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void
  onLocationQueryChange: (value: string) => void
  onLocationSearch: () => void
  onLocationSelect: (location: LocationCandidate) => void
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
  photoUrl,
  sourceDimensions,
  onSourceDimensions,
  onPhotoCrop,
  onPhotoFit,
  onFrameChange,
  onLayoutModeChange,
  onDetectSky,
  isDetectingSky,
  blendStatus,
  blendReady,
  photoError,
  isProcessingPhoto,
  photoIsEngraved,
  activeStep,
  locationQuery,
  locationCandidates,
  selectedLocation,
  isSearchingLocation,
  isResolvingMoment,
  formError,
  onMomentChange,
  onCustomTextChange,
  onMaterialStyleChange,
  onPhotoChange,
  onLocationQueryChange,
  onLocationSearch,
  onLocationSelect,
  onBack,
  onNext,
  onFinish,
}: ConfiguratorFormProps) {
  const nextLabel = activeStep === 1
    ? isResolvingMoment ? 'Building your sky…' : 'Build my sky'
    : 'Next step'

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
              <span className="field-label">Choose your frame opening</span>
              <div className="frame-size-options" role="group" aria-label="Frame opening size">
                {FRAME_PRESETS.map((preset) => (
                  <button type="button" key={preset.id}
                    className={designSpec.framePresetId === preset.id ? 'is-selected' : ''}
                    disabled={isResolvingMoment}
                    onClick={() => onFrameChange(preset.id)}>{preset.label}</button>
                ))}
              </div>
              <p className="field-hint">Nominal print sizes. Actual frame openings and mounting tolerances will be checked against our frame supplier before orders.</p>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="photo">A photo to remember</label>
              <label className="photo-dropzone" htmlFor="photo">
                <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} />
                <span className="photo-dropzone-content">
                  <span className="photo-icon" aria-hidden="true">+</span>
                  <strong>{photoFile ? photoFile.name : 'Choose a photo'}</strong>
                  <span>{photoFile ? (isProcessingPhoto ? 'Preparing engraving…' : photoIsEngraved ? 'Engraving preview ready' : 'Photo selected') : 'JPG, PNG, or WebP · up to 10 MB'}</span>
                </span>
              </label>
              {photoError && <p className="form-error" role="alert">{photoError}</p>}
              {photoIsEngraved && <p className="field-hint">Grayscale engraving preview ready. Final laser results depend on material testing.</p>}
              <p className="field-hint">Your photo is processed for a temporary preview, not saved to an order yet.</p>
              {photoUrl && (
                <PhotoCropEditor photoUrl={photoUrl}
                  aspect={designSpec.photo.positionMm.widthMm / designSpec.photo.positionMm.heightMm}
                  crop={designSpec.photo.crop} fitMode={designSpec.photo.fitMode}
                  dimensions={sourceDimensions} onDimensions={onSourceDimensions}
                  onCrop={onPhotoCrop} onFitMode={onPhotoFit}
                />
              )}
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="date">Date</label>
                <input
                  className="text-input"
                  id="date"
                  type="date"
                  value={designSpec.moment.date}
                  onChange={(event) => onMomentChange('date', event.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="time">Time <span className="field-hint">(optional if unknown)</span></label>
                <input
                  className="text-input"
                  id="time"
                  type="time"
                  value={designSpec.moment.time ?? ''}
                  disabled={designSpec.moment.exactTimeUnknown}
                  onChange={(event) => onMomentChange('time', event.target.value || null)}
                />
              </div>
            </div>
            <label className="toggle-row" htmlFor="unknown-time">
              <span>Exact time unknown</span>
              <span className="toggle-control">
                <input
                  id="unknown-time"
                  type="checkbox"
                  checked={designSpec.moment.exactTimeUnknown}
                  onChange={(event) => onMomentChange('exactTimeUnknown', event.target.checked)}
                />
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
            <p>Choose the real place so we can anchor the sky to the right coordinates and time zone.</p>
          </div>
          <div className="step-fields">
            <div className="field">
              <label className="field-label" htmlFor="names">Names or custom text</label>
              <input
                className="text-input"
                id="names"
                type="text"
                maxLength={48}
                placeholder="Avery & Jordan"
                value={designSpec.customText.value}
                onChange={(event) => onCustomTextChange(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="location">Where were you?</label>
              <div className="location-search-row">
                <input
                  className="text-input"
                  id="location"
                  type="text"
                  maxLength={120}
                  placeholder="Joshua Tree, California"
                  value={locationQuery}
                  onChange={(event) => onLocationQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onLocationSearch()
                    }
                  }}
                />
                <button
                  className="button-secondary location-search-button"
                  type="button"
                  onClick={onLocationSearch}
                  disabled={isSearchingLocation || locationQuery.trim().length < 2}
                >
                  {isSearchingLocation ? 'Finding…' : 'Find'}
                </button>
              </div>
              <p className="field-hint">Use a city, address, landmark, or venue. You can use a friendlier display label later.</p>
            </div>

            {locationCandidates.length > 0 && (
              <div className="location-results" role="radiogroup" aria-label="Location matches">
                {locationCandidates.map((candidate) => {
                  const selected =
                    selectedLocation?.latitude === candidate.latitude &&
                    selectedLocation?.longitude === candidate.longitude

                  return (
                    <button
                      className={`location-result ${selected ? 'is-selected' : ''}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      key={`${candidate.latitude}-${candidate.longitude}-${candidate.formattedAddress}`}
                      onClick={() => onLocationSelect(candidate)}
                    >
                      <strong>{candidate.displayName}</strong>
                      <span>{candidate.confidence} confidence</span>
                    </button>
                  )
                })}
              </div>
            )}

            {selectedLocation && (
              <div className="resolved-location">
                <span aria-hidden="true">✓</span>
                <span>
                  <strong>Selected location</strong>
                  <small>{selectedLocation.formattedAddress}</small>
                </span>
              </div>
            )}
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
            {designSpec.moment.location && (
              <div className="moment-confirmation">
                <span>Sky anchored to</span>
                <strong>{designSpec.moment.location.displayName}</strong>
                <small>{designSpec.moment.location.timeZoneId}</small>
                {designSpec.astronomy?.timeBasis === 'date-only-local-midnight' && (
                  <small>Exact time unknown — using local midnight as the representative sky.</small>
                )}
              </div>
            )}

            <div className="field">
              <span className="field-label">Your design style</span>
              <div className="layout-mode-options" role="group" aria-label="Design layout">
                <button type="button"
                  className={designSpec.layoutMode === 'classic' ? 'is-selected' : ''}
                  aria-pressed={designSpec.layoutMode === 'classic'}
                  onClick={() => onLayoutModeChange('classic')}>
                  <strong>Classic sky & photo</strong>
                  <small>A calculated star map above your portrait</small>
                </button>
                <button type="button"
                  className={designSpec.layoutMode === 'horizon-blend' ? 'is-selected' : ''}
                  aria-pressed={designSpec.layoutMode === 'horizon-blend'}
                  onClick={() => onLayoutModeChange('horizon-blend')}>
                  <strong>Horizon Blend · experimental</strong>
                  <small>Detect photo sky and artistically blend real stars</small>
                </button>
              </div>
              {designSpec.layoutMode === 'horizon-blend' && (
                <div className="blend-detection-panel">
                  <p>We'll look for visible sky using an optional AI model in your browser.
                    Your photo is not uploaded to the sky-detection provider.</p>
                  <button className="button-secondary" type="button"
                    disabled={isDetectingSky || !photoUrl || !designSpec.astronomy}
                    onClick={onDetectSky}>
                    {isDetectingSky ? 'Detecting sky…' : blendReady ? 'Re-detect sky' : 'Detect sky in my photo'}
                  </button>
                  <p className="field-hint" role="status">{blendStatus ||
                    (!photoUrl ? 'Upload an outdoor photograph with visible sky to try this style.' :
                      !designSpec.astronomy ? 'Build the sky for your moment before detection.' :
                      'Detection is optional and may fail on indoor photos or cloudy skies.')}
                  </p>
                  <p className="field-hint">The stars are drawn from real Hipparcos calculations, but this overlay is artistic:
                    it cannot reconstruct the camera's heading or field of view. Not a laser-ready design.</p>
                </div>
              )}
            </div>
            <div className="field">
              <span className="field-label">Choose your frame opening</span>
              <div className="frame-size-options" role="group" aria-label="Frame opening size">
                {FRAME_PRESETS.map((preset) => (
                  <button type="button" key={preset.id}
                    className={designSpec.framePresetId === preset.id ? 'is-selected' : ''}
                    disabled={isResolvingMoment}
                    onClick={() => onFrameChange(preset.id)}>{preset.label}</button>
                ))}
              </div>
              <p className="field-hint">Nominal print sizes. Actual frame openings and mounting tolerances will be checked against our frame supplier before orders.</p>
            </div>
            {photoUrl && (
              <PhotoCropEditor photoUrl={photoUrl}
                aspect={designSpec.photo.positionMm.widthMm / designSpec.photo.positionMm.heightMm}
                crop={designSpec.photo.crop} fitMode={designSpec.photo.fitMode}
                dimensions={sourceDimensions} onDimensions={onSourceDimensions}
                onCrop={onPhotoCrop} onFitMode={onPhotoFit}
              />
            )}
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

      {formError && <p className="form-error" role="alert">{formError}</p>}

      <div className="step-navigation">
        {activeStep > 0 ? <button className="button-secondary" type="button" onClick={onBack}>Back</button> : <span />}
        {activeStep < 2 ? (
          <button
            className="button-primary"
            type="button"
            onClick={onNext}
            disabled={isResolvingMoment}
          >
            {nextLabel} <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button className="button-primary" type="button" onClick={onFinish}>Preview ready <span aria-hidden="true">✦</span></button>
        )}
      </div>
    </form>
  )
}
