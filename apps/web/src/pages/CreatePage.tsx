import type { ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import { ConfiguratorForm } from '../components/ConfiguratorForm'
import { ProgressSteps } from '../components/ProgressSteps'
import { SiteHeader } from '../components/SiteHeader'
import { StarKeepsakePreview } from '../components/StarKeepsakePreview'
import { INITIAL_DESIGN_SPEC } from '../designSpec'
import type { DesignSpec } from '../designSpec'

const steps = ['Your moment', 'Your story', 'Your object']

export function CreatePage() {
  const [activeStep, setActiveStep] = useState(0)
  const [designSpec, setDesignSpec] = useState<DesignSpec>(INITIAL_DESIGN_SPEC)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const updateMoment = <K extends keyof DesignSpec['moment']>(field: K, value: DesignSpec['moment'][K]) => {
    setDesignSpec((current) => ({
      ...current,
      moment: { ...current.moment, [field]: value },
    }))
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

  const handleNext = () => {
    setActiveStep((current) => Math.min(current + 1, steps.length - 1))
    setIsReady(false)
  }

  const handleBack = () => {
    setActiveStep((current) => Math.max(current - 1, 0))
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
              onMomentChange={updateMoment}
              onCustomTextChange={updateCustomText}
              onMaterialStyleChange={updateMaterialStyle}
              onPhotoChange={handlePhotoChange}
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
