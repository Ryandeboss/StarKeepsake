import type { ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import { generateAstronomy, generateEngravingPreview, resolveMoment, searchLocations } from '../api'
import type { LocationCandidate } from '../api'
import { ConfiguratorForm } from '../components/ConfiguratorForm'
import { ProgressSteps } from '../components/ProgressSteps'
import { SiteHeader } from '../components/SiteHeader'
import { StarKeepsakePreview } from '../components/StarKeepsakePreview'
import { getFrameLayout, INITIAL_DESIGN_SPEC } from '../designSpec'
import type { DesignSpec, FramePresetId, PhotoCrop } from '../designSpec'
import { FULL_PHOTO_CROP, getCoverCrop } from '../photoCrop'

const steps = ['Your moment', 'Your story', 'Your object']
type MomentInputField = 'date' | 'time' | 'exactTimeUnknown'

export function CreatePage() {
  const [activeStep, setActiveStep] = useState(0)
  const [designSpec, setDesignSpec] = useState<DesignSpec>(INITIAL_DESIGN_SPEC)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [engravingPreview, setEngravingPreview] = useState('')
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
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
    if (designSpec.photo.fitMode === 'cover') {
      const { widthMm, heightMm } = designSpec.photo.positionMm
      updatePhotoCrop(getCoverCrop(size.width, size.height, widthMm / heightMm))
    }
  }

  const updateFrame = async (id: FramePresetId) => {
    if (id === designSpec.framePresetId) return
    const { physicalArtwork, regions } = getFrameLayout(id)
    setIsReady(false)
    setPhotoError('')
    setEngravingPreview('')
    setIsProcessingPhoto(Boolean(photoFile))
    setDesignSpec((current) => ({
      ...current,
      framePresetId: id,
      physicalArtwork,
      regions,
      photo: {
        ...current.photo,
        positionMm: regions.engravingPhoto,
        crop: current.photo.fitMode === 'cover' && sourceDimensions
          ? getCoverCrop(sourceDimensions.width, sourceDimensions.height,
            regions.engravingPhoto.widthMm / regions.engravingPhoto.heightMm)
          : FULL_PHOTO_CROP,
      },
      customText: { ...current.customText, positionMm: regions.text },
      astronomy: null,
      stars: [],
    }))
    if (designSpec.moment.location) {
      setIsResolvingMoment(true)
      try {
        const astronomy = await generateAstronomy(designSpec.moment, designSpec.skySettings, id)
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

        const astronomy = await generateAstronomy(resolved, designSpec.skySettings, designSpec.framePresetId)

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
              onFinish={() => setIsReady(true)}
            />
            <p className="sr-only" aria-live="polite">{isReady ? 'Your StarKeepsake preview is ready.' : ''}</p>
          </div>
          <StarKeepsakePreview
            designSpec={designSpec}
            photoPreview={photoPreview}
            engravingPreview={engravingPreview}
            isProcessingPhoto={isProcessingPhoto}
          />
        </div>
      </main>
    </div>
  )
}
