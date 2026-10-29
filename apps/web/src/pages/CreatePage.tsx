import type { ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import { generateAstronomy, resolveMoment, searchLocations } from '../api'
import type { LocationCandidate } from '../api'
import { ConfiguratorForm } from '../components/ConfiguratorForm'
import { ProgressSteps } from '../components/ProgressSteps'
import { SiteHeader } from '../components/SiteHeader'
import { StarKeepsakePreview } from '../components/StarKeepsakePreview'
import { INITIAL_DESIGN_SPEC } from '../designSpec'
import type { DesignSpec } from '../designSpec'

const steps = ['Your moment', 'Your story', 'Your object']
type MomentInputField = 'date' | 'time' | 'exactTimeUnknown'

export function CreatePage() {
  const [activeStep, setActiveStep] = useState(0)
  const [designSpec, setDesignSpec] = useState<DesignSpec>(INITIAL_DESIGN_SPEC)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
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

    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setDesignSpec((current) => ({
      ...current,
      photo: { ...current.photo, assetId: file.name },
    }))
    setIsReady(false)
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

        const astronomy = await generateAstronomy(resolved, designSpec.skySettings)

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
          <StarKeepsakePreview designSpec={designSpec} photoPreview={photoPreview} />
        </div>
      </main>
    </div>
  )
}
