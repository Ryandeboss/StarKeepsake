type ProgressStepsProps = {
  activeStep: number
  steps: string[]
}

export function ProgressSteps({ activeStep, steps }: ProgressStepsProps) {
  return (
    <nav className="progress-bar" aria-label="Configurator progress">
      {steps.map((step, index) => {
        const isActive = index === activeStep
        const isComplete = index < activeStep

        return (
          <div
            className={`progress-step ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}
            key={step}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="progress-number">{isComplete ? '✓' : index + 1}</span>
            <span>{step}</span>
          </div>
        )
      })}
    </nav>
  )
}
