import type { ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import { ConfiguratorForm } from '../components/ConfiguratorForm'
import { ProgressSteps } from '../components/ProgressSteps'
import { SiteHeader } from '../components/SiteHeader'
import { StarKeepsakePreview } from '../components/StarKeepsakePreview'
import type { ConfiguratorState } from '../types'

const steps = ['Your moment', 'Your story', 'Your object']

const initialForm: ConfiguratorState = {
  photoFile: null,
  photoPreview: '',
  date: '',
  time: '',
  exactTimeUnknown: false,
  location: '',
  names: '',
  frameStyle: 'Midnight frame',
}

export function CreatePage() {
  const [activeStep, setActiveStep] = useState(0)
  const [form, setForm] = useState<ConfiguratorState>(initialForm)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    return () => {
      if (form.photoPreview) URL.revokeObjectURL(form.photoPreview)
    }
  }, [form.photoPreview])

  const updateField = <K extends keyof ConfiguratorState>(field: K, value: ConfiguratorState[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
    setIsReady(false)
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setForm((current) => ({
      ...current,
      photoFile: file,
      photoPreview: URL.createObjectURL(file),
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
              form={form}
              activeStep={activeStep}
              onChange={updateField}
              onPhotoChange={handlePhotoChange}
              onBack={handleBack}
              onNext={handleNext}
              onFinish={() => setIsReady(true)}
            />
            <p className="sr-only" aria-live="polite">{isReady ? 'Your StarKeepsake preview is ready.' : ''}</p>
          </div>
          <StarKeepsakePreview form={form} />
        </div>
      </main>
    </div>
  )
}
