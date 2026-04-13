import { useState } from 'react'
import { OnboardingStepper, type StepperStep } from '../../../shared/ui/react-bits/OnboardingStepper'
import { ScreenHeader } from '../../../shared/ui/typography/ScreenHeader'
import { FormField } from '../../../shared/ui/forms/FormField'
import { ToggleRow } from '../../../shared/ui/forms/ToggleRow'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'

type OnboardingValues = {
  name: string
  weeklyHours: number
  sameHoursEachDay: boolean
  mandatoryBreak: boolean
  breakDuration: number
  maxBreaks: number
  remindersEnabled: boolean
}

const initialValues: OnboardingValues = {
  name: '',
  weeklyHours: 40,
  sameHoursEachDay: true,
  mandatoryBreak: true,
  breakDuration: 30,
  maxBreaks: 2,
  remindersEnabled: true,
}

export function OnboardingScreen() {
  const [values, setValues] = useState(initialValues)
  const [submitted, setSubmitted] = useState(false)

  const steps: StepperStep<OnboardingValues>[] = [
    {
      id: 'name',
      title: 'Nombre',
      description: 'Personaliza el saludo y da contexto humano al onboarding.',
      render: (
        <FormField label="Nombre">
          <input
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            className="nuba-input"
          />
        </FormField>
      ),
      validate: (current) => (!current.name.trim() ? 'Indica un nombre.' : null),
    },
    {
      id: 'hours',
      title: 'Horas semanales',
      description: 'Sirve como guía para metas, onboarding y educación del producto.',
      render: (
        <FormField label="Horas por semana">
          <input
            type="number"
            min={1}
            step={1}
            value={values.weeklyHours}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                weeklyHours: Number(event.target.value) || 0,
              }))
            }
            className="nuba-input"
          />
        </FormField>
      ),
      validate: (current) => (current.weeklyHours <= 0 ? 'Introduce horas válidas.' : null),
    },
    {
      id: 'schedule',
      title: 'Jornada',
      description: 'Decisión clave de UX para configurar después las metas diarias.',
      render: (
        <ToggleRow
          name="sameHoursEachDay"
          label="Misma jornada todos los días"
          description="Esto conecta de forma natural con `sameHoursEachDay` del prototipo."
          checked={values.sameHoursEachDay}
          onChange={(checked) =>
            setValues((current) => ({ ...current, sameHoursEachDay: checked }))
          }
        />
      ),
    },
    {
      id: 'breaks',
      title: 'Pausas',
      description: 'Estos campos tienen sentido de producto y ya pueden vivir en persistencia local.'
      ,
      render: (
        <div className="space-y-4">
          <ToggleRow
            name="mandatoryBreak"
            label="Pausa obligatoria"
            checked={values.mandatoryBreak}
            onChange={(checked) =>
              setValues((current) => ({ ...current, mandatoryBreak: checked }))
            }
          />
          <FormField label="Duración de la pausa (minutos)">
            <input
              type="number"
              min={0}
              value={values.breakDuration}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  breakDuration: Number(event.target.value) || 0,
                }))
              }
              className="nuba-input"
            />
          </FormField>
          <FormField label="Número máximo de descansos">
            <input
              type="number"
              min={0}
              value={values.maxBreaks}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  maxBreaks: Number(event.target.value) || 0,
                }))
              }
              className="nuba-input"
            />
          </FormField>
        </div>
      ),
    },
    {
      id: 'reminders',
      title: 'Avisos',
      description: 'Cierra el flujo con una decisión útil y fácil de entender.',
      render: (
        <ToggleRow
          name="remindersEnabled"
          label="Activar recordatorios"
          checked={values.remindersEnabled}
          onChange={(checked) =>
            setValues((current) => ({ ...current, remindersEnabled: checked }))
          }
        />
      ),
    },
    {
      id: 'summary',
      title: 'Resumen',
      description: 'Antes de guardar, el usuario revisa lo importante sin enfrentarse a un formulario eterno.',
      render: (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/8 bg-nuba-surface-elevated/80 p-4 text-sm text-nuba-text-muted">
            Nombre: <span className="font-medium text-nuba-text">{values.name}</span>
          </div>
          <div className="rounded-3xl border border-white/8 bg-nuba-surface-elevated/80 p-4 text-sm text-nuba-text-muted">
            Horas/semana: <span className="font-medium text-nuba-text">{values.weeklyHours}</span>
          </div>
          <div className="rounded-3xl border border-white/8 bg-nuba-surface-elevated/80 p-4 text-sm text-nuba-text-muted">
            Jornada uniforme: <span className="font-medium text-nuba-text">{values.sameHoursEachDay ? 'Sí' : 'No'}</span>
          </div>
          <div className="rounded-3xl border border-white/8 bg-nuba-surface-elevated/80 p-4 text-sm text-nuba-text-muted">
            Recordatorios: <span className="font-medium text-nuba-text">{values.remindersEnabled ? 'Activos' : 'Desactivados'}</span>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <ScreenHeader
        eyebrow="Onboarding"
        title="Stepper inicial de Nuba"
        description="Flujo pensado para móvil y progresión corta. La persistencia vive en el frontend para este prototipo."
      />

      <InlineAlert tone="warning" title="Alcance actual">
        En esta base inicial el stepper es una propuesta funcional de UX. Podemos decidir después qué campos conviene guardar también en local.
      </InlineAlert>

      <OnboardingStepper
        steps={steps}
        values={values}
        onSubmit={() => setSubmitted(true)}
      />

      {submitted ? (
        <InlineAlert tone="success" title="Resumen preparado">
          El flujo está listo para conectarse a persistencia local parcial en fases posteriores sin acoplar la experiencia a un servidor.
        </InlineAlert>
      ) : null}
    </div>
  )
}
