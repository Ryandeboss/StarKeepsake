import type { ChangeEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { generateAstronomy, generateEngravingPreview, resolveMoment, searchLocations } from '../api'
import type { LocationCandidate } from '../api'
import { ConfiguratorForm } from '../components/ConfiguratorForm'
import { ProgressSteps } from '../components/ProgressSteps'
import { SiteHeader } from '../components/SiteHeader'
import { StarKeepsakePreview } from '../components/StarKeepsakePreview'
import { getFrameLayout, INITIAL_DESIGN_SPEC, toRect } from '../designSpec'
import type { DesignSpec, FramePresetId, PhotoCrop } from '../designSpec'
import { FULL_PHOTO_CROP, getCoverCrop } from '../photoCrop'
import { generateHorizonBlend } from '../skyBlend'

const steps = ['Your moment', 'Your story', 'Your object']
type MomentInputField = 'date' | 'time' | 'exactTimeUnknown'

export function CreatePage() {
  const [activeStep, setActiveStep] = useState(0)
  const [designSpec, setDesignSpec] = useState<DesignSpec>(INITIAL_DESIGN_SPEC)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null)
  const [frameTouched, setFrameTouched] = useState(false)
  const [photoPreview, setPhotoPreview] = useState('')
  const [engravingPreview, setEngravingPreview] = useState('')
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [blendPreview, setBlendPreview] = useState('')
  const [blendStatus, setBlendStatus] = useState('')
  const [blendReady, setBlendReady] = useState(false)
  const [isDetectingSky, setIsDetectingSky] = useState(false)
  const blendRequestRef = useRef(0)
  const [isReady, setIsReady] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationCandidates, setLocationCandidates] = useState<LocationCandidate[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationCandidate | null>(null)
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [isResolvingMoment, setIsResolvingMoment] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  useEffect(() => {
    return () => {
      if (engravingPreview) URL.revokeObjectURL(engravingPreview)
    }
  }, [engravingPreview])

  useEffect(() => {
    if (!photoFile) return

    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      generateEngravingPreview(photoFile, designSpec, controller.signal)
        .then((png) => {
          if (!cancelled) setEngravingPreview(URL.createObjectURL(png))
        })
        .catch((error: unknown) => {
          if (!cancelled && !controller.signal.aborted) {
            setPhotoError(error instanceof Error ? error.message : 'Could not process this photo.')
          }
        })
        .finally(() => {
          if (!cancelled) setIsProcessingPhoto(false)
        })
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [photoFile, designSpec.framePresetId, designSpec.photo])

  useEffect(() => {
    return () => {
      if (blendPreview) URL.revokeObjectURL(blendPreview)
    }
  }, [blendPreview])

  const clearBlend = () => {
    blendRequestRef.current += 1
    setBlendPreview('')
    setBlendStatus('')
    setBlendReady(false)
    setIsDetectingSky(false)
  }

  const handleLayoutModeChange = (layoutMode: DesignSpec['layoutMode']) => {
    setDesignSpec((current) => ({ ...current, layoutMode }))
    clearBlend()
    setIsReady(false)
  }

  const handleDetectSky = async () => {
    if (!photoPreview || !designSpec.astronomy || !designSpec.stars.length) {
      setBlendStatus('Upload a photo and calculate the sky first.')
      return
    }
    const requestId = ++blendRequestRef.current
    setBlendPreview('')
    setBlendReady(false)
    setIsDetectingSky(true)
    setBlendStatus('Loading the sky-detection model and analyzing your image locally…')
    try {
      const result = await generateHorizonBlend(photoPreview, designSpec)
      if (requestId !== blendRequestRef.current) return
      if (result.kind === 'no-sky') {
        setBlendStatus('No usable open sky was recognized in this photo. Try an outdoor photo with a visible horizon, or select Classic Frame.')
        return
      }
      setBlendPreview(URL.createObjectURL(result.image))
      setBlendReady(true)
      setBlendStatus(`Detected ~${result.skyPercent}% sky; blended ${result.placedStars} real catalog stars (artistic placement).`)
    } catch (error) {
      if (requestId !== blendRequestRef.current) return
      setBlendStatus(error instanceof Error ? error.message : 'Sky detection did not work on this device. Classic Frame remains available.')
    } finally {
      if (requestId === blendRequestRef.current) setIsDetectingSky(false)
    }
  }

  const updatePhotoCrop = (crop: PhotoCrop) => {
    setDesignSpec((current) => ({
      ...current,
      photo: { ...current.photo, crop },
    }))
    setEngravingPreview('')
    setPhotoError('')
    setIsProcessingPhoto(true)
    setIsReady(false)
  }

  const updatePhotoFit = (fitMode: 'contain' | 'cover', crop: PhotoCrop) => {
    setDesignSpec((current) => ({
      ...current,
      photo: { ...current.photo, fitMode, crop },
    }))
    setEngravingPreview('')
    setPhotoError('')
    setIsProcessingPhoto(Boolean(photoFile))
    setIsReady(false)
  }

  const handleSourceDimensions = (size: { width: number; height: number }) => {
    setSourceDimensions(size)
    if (designSpec.framePresetId === 'auto' || !frameTouched) {
      const ratio = Math.min(3, Math.max(.35, size.width / size.height))
      const { physicalArtwork, regions } = getFrameLayout('auto', ratio)
      setDesignSpec((current) => ({
        ...current,
        photoAspectRatio: ratio,
        physicalArtwork,
        regions,
        photo: { ...current.photo, positionMm: toRect(regions.engravingPhoto), crop: FULL_PHOTO_CROP, fitMode: 'contain' },
        customText: { ...current.customText, positionMm: toRect(regions.text) },
        astronomy: null, stars: [],
      }))
    } else {
      setDesignSpec((current) => ({ ...current, photoAspectRatio: size.width / size.height }))
    }
    if (designSpec.photo.fitMode === 'cover' && designSpec.framePresetId !== 'auto' && frameTouched) {
      const { widthMm, heightMm } = designSpec.photo.positionMm
      updatePhotoCrop(getCoverCrop(size.width, size.height, widthMm / heightMm))
    }
  }

  const updateFrame = async (id: FramePresetId) => {
    setFrameTouched(true)
    if (id === designSpec.framePresetId) return
    clearBlend()
    if (id === 'auto' && !sourceDimensions) {
      setFormError('Upload a photo first to make a custom-sized frame.')
      return
    }
    const photoAspectRatio = sourceDimensions ? sourceDimensions.width / sourceDimensions.height : null
    const { physicalArtwork, regions } = getFrameLayout(id, photoAspectRatio)
    setIsReady(false)
    setPhotoError('')
    setEngravingPreview('')
    setIsProcessingPhoto(Boolean(photoFile))
    setDesignSpec((current) => ({
      ...current,
      framePresetId: id,
      photoAspectRatio,
      physicalArtwork,
      regions,
      photo: {
        ...current.photo,
        positionMm: toRect(regions.engravingPhoto),
        crop: current.photo.fitMode === 'cover' && sourceDimensions
          ? getCoverCrop(sourceDimensions.width, sourceDimensions.height,
            regions.engravingPhoto.widthMm / regions.engravingPhoto.heightMm)
          : FULL_PHOTO_CROP,
      },
      customText: { ...current.customText, positionMm: toRect(regions.text) },
      astronomy: null,
      stars: [],
    }))
    if (designSpec.moment.location) {
      setIsResolvingMoment(true)
      try {
        const astronomy = await generateAstronomy(designSpec.moment, designSpec.skySettings, id, photoAspectRatio)
        setDesignSpec((current) => current.framePresetId === id
          ? { ...current, astronomy: astronomy.calculation, stars: astronomy.stars }
          : current)
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Could not rebuild the sky.')
      } finally {
        setIsResolvingMoment(false)
      }
    }
  }

  const updateMoment = <K extends MomentInputField>(
    field: K,
    value: DesignSpec['moment'][K],
  ) => {
    clearBlend()
    setDesignSpec((current) => {
      const nextMoment = {
        ...current.moment,
        [field]: value,
        localDateTime: null,
        utcDateTime: null,
      }

      if (field === 'exactTimeUnknown' && value === true) {
        nextMoment.time = null
      }

      return {
        ...current,
        moment: nextMoment,
        astronomy: null,
        stars: [],
      }
    })
    setFormError('')
    setIsReady(false)
  }

  const updateCustomText = (value: string) => {
    setDesignSpec((current) => ({
      ...current,
      customText: { ...current.customText, value },
    }))
    setIsReady(false)
  }

  const updateMaterialStyle = (materialStyle: DesignSpec['materialStyle']) => {
    setDesignSpec((current) => ({ ...current, materialStyle }))
    setIsReady(false)
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isSupported = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    const isWithinSize = file.size <= 10 * 1024 * 1024

    clearBlend()
    setPhotoError('')
    setEngravingPreview('')
    setIsProcessingPhoto(false)
    setIsReady(false)
    if (!isSupported || !isWithinSize) {
      setPhotoError(isSupported ? 'Choose a photo of 10 MB or less.' : 'Use a JPG, PNG, or WebP photo.')
      setPhotoFile(null)
      setPhotoPreview('')
      setDesignSpec((current) => ({
        ...current,
        photoAspectRatio: null,
        photo: { ...current.photo, assetId: 'local-photo-placeholder' },
      }))
      return
    }

    setIsProcessingPhoto(true)
    setSourceDimensions(null)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setDesignSpec((current) => ({
      ...current,
      photo: { ...current.photo, assetId: 'unpersisted-preview-only', fitMode: 'contain', crop: FULL_PHOTO_CROP },
    }))
  }

  const handleLocationQueryChange = (value: string) => {
    clearBlend()
    setLocationQuery(value)
    setLocationCandidates([])
    setSelectedLocation(null)
    setFormError('')
    setDesignSpec((current) => ({
      ...current,
      moment: {
        ...current.moment,
        location: null,
        localDateTime: null,
        utcDateTime: null,
      },
      astronomy: null,
      stars: [],
    }))
    setIsReady(false)
  }

  const handleLocationSearch = async () => {
    if (locationQuery.trim().length < 2) {
      setFormError('Enter at least two characters to search for a location.')
      return
    }

    setIsSearchingLocation(true)
    setFormError('')

    try {
      const candidates = await searchLocations(locationQuery)
      setLocationCandidates(candidates)

      if (candidates.length === 0) {
        setFormError('No matching places were found. Try a city, address, landmark, or venue.')
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Location search failed.')
    } finally {
      setIsSearchingLocation(false)
    }
  }

  const handleLocationSelect = (location: LocationCandidate) => {
    clearBlend()
    setSelectedLocation(location)
    setDesignSpec((current) => ({
      ...current,
      moment: {
        ...current.moment,
        location: null,
        localDateTime: null,
        utcDateTime: null,
      },
      astronomy: null,
      stars: [],
    }))
    setFormError('')
    setIsReady(false)
  }

  const handleNext = async () => {
    setFormError('')

    if (activeStep === 0) {
      if (!designSpec.moment.date) {
        setFormError('Choose the date for this memory.')
        return
      }

      if (!designSpec.moment.exactTimeUnknown && !designSpec.moment.time) {
        setFormError('Choose the local time, or mark the exact time as unknown.')
        return
      }

      setActiveStep(1)
      setIsReady(false)
      return
    }

    if (activeStep === 1) {
      if (!selectedLocation) {
        setFormError('Search for the location and choose the correct match before continuing.')
        return
      }

      setIsResolvingMoment(true)

      try {
        const resolved = await resolveMoment({
          date: designSpec.moment.date,
          time: designSpec.moment.time,
          exactTimeUnknown: designSpec.moment.exactTimeUnknown,
          locationQuery,
          location: selectedLocation,
        })

        const astronomy = await generateAstronomy(resolved, designSpec.skySettings, designSpec.framePresetId, designSpec.photoAspectRatio)
        clearBlend()

        setDesignSpec((current) => ({
          ...current,
          moment: resolved,
          astronomy: astronomy.calculation,
          stars: astronomy.stars,
        }))
        setActiveStep(2)
        setIsReady(false)
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'We could not resolve this moment.')
      } finally {
        setIsResolvingMoment(false)
      }

      return
    }

    setActiveStep((current) => Math.min(current + 1, steps.length - 1))
    setIsReady(false)
  }

  const handleBack = () => {
    setActiveStep((current) => Math.max(current - 1, 0))
    setFormError('')
    setIsReady(false)
  }

  return (
    <div className="site-shell">
      <SiteHeader currentPage="create" />
      <main className="create-page">
        <section className="create-intro" aria-labelledby="create-heading">
          <div>
            <p className="eyebrow">Create a StarKeepsake</p>
            <h1 id="create-heading">Let’s make your moment visible.</h1>
          </div>
          <p>Shape a first look at the piece you’ll keep long after the night is over.</p>
        </section>

        <div className="create-layout">
          <div>
            <ProgressSteps activeStep={activeStep} steps={steps} />
            <ConfiguratorForm
              designSpec={designSpec}
              photoFile={photoFile}
              photoUrl={photoPreview}
              sourceDimensions={sourceDimensions}
              onSourceDimensions={handleSourceDimensions}
              onPhotoCrop={updatePhotoCrop}
              onPhotoFit={updatePhotoFit}
              onFrameChange={updateFrame}
              onLayoutModeChange={handleLayoutModeChange}
              onDetectSky={handleDetectSky}
              isDetectingSky={isDetectingSky}
              blendStatus={blendStatus}
              blendReady={blendReady}
              photoError={photoError}
              isProcessingPhoto={isProcessingPhoto}
              photoIsEngraved={Boolean(engravingPreview)}
              activeStep={activeStep}
              locationQuery={locationQuery}
              locationCandidates={locationCandidates}
              selectedLocation={selectedLocation}
              isSearchingLocation={isSearchingLocation}
              isResolvingMoment={isResolvingMoment}
              formError={formError}
              onMomentChange={updateMoment}
              onCustomTextChange={updateCustomText}
              onMaterialStyleChange={updateMaterialStyle}
              onPhotoChange={handlePhotoChange}
              onLocationQueryChange={handleLocationQueryChange}
              onLocationSearch={handleLocationSearch}
              onLocationSelect={handleLocationSelect}
              onBack={handleBack}
              onNext={handleNext}
              onFinish={() => {
                if (designSpec.layoutMode === 'horizon-blend' && !blendReady) {
                  setFormError('Run sky detection successfully or choose Classic Frame before finishing.')
                  return
                }
                setFormError('')
                setIsReady(true)
              }}
            />
            <p className="sr-only" aria-live="polite">{isReady ? 'Your StarKeepsake preview is ready.' : ''}</p>
          </div>
          <StarKeepsakePreview
            designSpec={designSpec}
            photoPreview={photoPreview}
            engravingPreview={engravingPreview}
            isProcessingPhoto={isProcessingPhoto}
            blendPreview={blendPreview}
          />
        </div>
      </main>
    </div>
  )
}
