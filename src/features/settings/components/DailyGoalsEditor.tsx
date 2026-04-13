import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import type { DayOfWeek } from '../../../shared/types/common'
import { FormField } from '../../../shared/ui/forms/FormField'
import { getDayOfWeekLabel } from '../../../shared/utils/format'

export type GoalsFormValues = {
  goals: {
    dayOfWeek: DayOfWeek
    targetMinutes: number
  }[]
}

type DailyGoalsEditorProps = {
  control: Control<GoalsFormValues>
  errors: FieldErrors<GoalsFormValues>
  register: UseFormRegister<GoalsFormValues>
}

export function DailyGoalsEditor({
  control,
  errors,
  register,
}: DailyGoalsEditorProps) {
  const goals = useWatch({ control, name: 'goals' })

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {goals.map((goal, index) => (
        <FormField
          key={goal.dayOfWeek}
          label={getDayOfWeekLabel(goal.dayOfWeek)}
          description="Minutos objetivo para ese día."
          error={errors.goals?.[index]?.targetMinutes?.message}
        >
          <input
            type="number"
            min={0}
            step={15}
            className="nuba-input"
            {...register(`goals.${index}.targetMinutes`, { valueAsNumber: true })}
          />
        </FormField>
      ))}
    </div>
  )
}
