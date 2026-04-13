import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { PrimaryButton, SecondaryButton } from '../buttons/Button'
import { SectionCard } from '../cards/SectionCard'
import { cn } from '../../utils/cn'

export type StepperStep<TValues> = {
  id: string
  title: string
  description: string
  render: ReactNode
  validate?: (values: TValues) => string | null
}

type OnboardingStepperProps<TValues> = {
  steps: StepperStep<TValues>[]
  values: TValues
  onSubmit: () => void
}

export function OnboardingStepper<TValues>({
  onSubmit,
  steps,
  values,
}: OnboardingStepperProps<TValues>) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentStep = steps[currentIndex]
  const validationError = currentStep.validate?.(values) ?? null
  const isLastStep = currentIndex === steps.length - 1

  const completion = useMemo(
    () => Math.round(((currentIndex + 1) / steps.length) * 100),
    [currentIndex, steps.length],
  )

  return (
    <SectionCard
      title="Configuración inicial guiada"
      description="Pensada para móvil, con pasos cortos y validación progresiva para reducir fricción."
      className="overflow-hidden"
    >
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between text-sm text-nuba-text-muted">
          <span>Paso {currentIndex + 1} de {steps.length}</span>
          <span>{completion}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/6">
          <motion.div
            className="h-full rounded-full bg-nuba-brand"
            animate={{ width: `${completion}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
          />
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => {
              if (index <= currentIndex) {
                setCurrentIndex(index)
              }
            }}
            className={cn(
              'rounded-full border px-3 py-2 text-xs font-medium transition',
              index === currentIndex
                ? 'border-nuba-brand/30 bg-nuba-brand/10 text-nuba-brand'
                : index < currentIndex
                  ? 'border-nuba-check-in/20 bg-nuba-check-in/10 text-nuba-check-in'
                  : 'border-white/8 text-nuba-text-muted',
            )}
          >
            {index < currentIndex ? <Check className="mr-2 inline h-3 w-3" /> : null}
            {step.title}
          </button>
        ))}
      </div>

      <motion.div
        key={currentStep.id}
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="space-y-3"
      >
        <div>
          <h4 className="text-xl font-semibold text-nuba-text">{currentStep.title}</h4>
          <p className="text-sm leading-6 text-nuba-text-muted">{currentStep.description}</p>
        </div>
        <div>{currentStep.render}</div>
      </motion.div>

      {validationError ? (
        <p className="mt-4 text-sm text-nuba-error">{validationError}</p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <SecondaryButton
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </SecondaryButton>

        {isLastStep ? (
          <PrimaryButton onClick={onSubmit} disabled={Boolean(validationError)}>
            Guardar propuesta
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => setCurrentIndex((index) => Math.min(steps.length - 1, index + 1))}
            disabled={Boolean(validationError)}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </PrimaryButton>
        )}
      </div>
    </SectionCard>
  )
}
