import { useEffect, useMemo, type InputHTMLAttributes } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { queryClient } from '../../../shared/api/query-client'
import { calendarKeys } from '../api/calendar.keys'
import { statisticsKeys } from '../../dashboard/api/statistics.keys'
import { workSessionKeys } from '../../work-sessions/api/workSessions.keys'
import { workSessionsApi } from '../../work-sessions/api/workSessions.api'
import { useWorkSessionDetailQuery } from '../../work-sessions/hooks/useWorkSessionDetailQuery'
import { SecondaryButton, PrimaryButton } from '../../../shared/ui/buttons/Button'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'
import { cn } from '../../../shared/utils/cn'
import {
  formatMinutesCompact,
  fromBusinessDateAndTime,
  toTimeInputValue,
} from '../../../shared/utils/format'
import { isApiError } from '../../../shared/api/api-error'

const timeFieldSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Introduce una hora válida.')
const optionalTimeFieldSchema = z.union([timeFieldSchema, z.literal('')])

const sessionEditorFormSchema = z.object({
  startTime: timeFieldSchema,
  endTime: optionalTimeFieldSchema,
  notes: z.string().max(240),
  breaks: z.array(
    z.object({
      id: z.string().optional(),
      breakType: z.enum(['LUNCH', 'OTHER']),
      startTime: timeFieldSchema,
      endTime: optionalTimeFieldSchema,
    }),
  ),
})

type SessionEditorFormValues = z.infer<typeof sessionEditorFormSchema>

const parseTimeToMinutes = (value: string) => {
  const [hours = '0', minutes = '0'] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}

const getBreakTypeLabel = (value: 'LUNCH' | 'OTHER') =>
  value === 'LUNCH' ? 'Comida' : 'Pausa'

function TimeField({
  error,
  label,
  ...props
}: {
  error?: string
  label: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="space-y-2">
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-nuba-text-muted/60">
        {label}
      </span>
      <input
        type="time"
        className={cn(
          'w-full rounded-[18px] border bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.8),_rgb(18_24_33_/_0.92))] px-3 py-3 text-sm font-semibold text-nuba-text outline-none transition focus:border-nuba-brand/44',
          error ? 'border-nuba-check-out/40' : 'border-white/[0.08]',
        )}
        {...props}
      />
      {error ? <p className="text-xs text-nuba-check-out">{error}</p> : null}
    </label>
  )
}

export function WorkSessionEditorPanel({
  date,
  onCancel,
  onSaved,
  sessionId,
}: {
  date: string
  onCancel: () => void
  onSaved: () => void
  sessionId: string
}) {
  const detailQuery = useWorkSessionDetailQuery(sessionId)
  const form = useForm<SessionEditorFormValues>({
    resolver: zodResolver(sessionEditorFormSchema),
    defaultValues: {
      startTime: '',
      endTime: '',
      notes: '',
      breaks: [],
    },
  })
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'breaks',
    keyName: 'fieldId',
  })

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    form.reset({
      startTime: toTimeInputValue(detailQuery.data.session.startTime),
      endTime: toTimeInputValue(detailQuery.data.session.endTime),
      notes: detailQuery.data.session.notes ?? '',
      breaks: detailQuery.data.breaks.map((workBreak) => ({
        id: workBreak.id,
        breakType: workBreak.breakType,
        startTime: toTimeInputValue(workBreak.startTime),
        endTime: toTimeInputValue(workBreak.endTime),
      })),
    })
    replace(
      detailQuery.data.breaks.map((workBreak) => ({
        id: workBreak.id,
        breakType: workBreak.breakType,
        startTime: toTimeInputValue(workBreak.startTime),
        endTime: toTimeInputValue(workBreak.endTime),
      })),
    )
  }, [detailQuery.data, form, replace])

  const values = useWatch<SessionEditorFormValues>({ control: form.control })
  const summary = useMemo(() => {
    const startMinutes = values.startTime ? parseTimeToMinutes(values.startTime) : 0
    const endMinutes = values.endTime ? parseTimeToMinutes(values.endTime) : 0
    const breakMinutes = (values.breaks ?? []).reduce((total, workBreak) => {
      if (!workBreak.startTime || !workBreak.endTime) {
        return total
      }

      return total + Math.max(0, parseTimeToMinutes(workBreak.endTime) - parseTimeToMinutes(workBreak.startTime))
    }, 0)

    return {
      breakMinutes,
      workedMinutes: Math.max(0, endMinutes - startMinutes - breakMinutes),
    }
  }, [values.breaks, values.endTime, values.startTime])

  const mutation = useMutation({
    mutationFn: (payload: SessionEditorFormValues) =>
      workSessionsApi.update(sessionId, {
        startTime: fromBusinessDateAndTime(date, payload.startTime) ?? '',
        endTime: payload.endTime
          ? fromBusinessDateAndTime(date, payload.endTime)
          : null,
        notes: payload.notes.trim() || null,
        reason: 'Ajuste manual desde calendario.',
        breaks: payload.breaks.map((workBreak) => ({
          id: workBreak.id,
          breakType: workBreak.breakType,
          startTime: fromBusinessDateAndTime(date, workBreak.startTime) ?? '',
          endTime: workBreak.endTime
            ? fromBusinessDateAndTime(date, workBreak.endTime)
            : null,
        })),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workSessionKeys.all }),
        queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
        queryClient.invalidateQueries({ queryKey: statisticsKeys.all }),
      ])
      onSaved()
    },
  })

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.03] px-4 py-5 text-sm text-nuba-text-muted/78">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin text-nuba-brand" />
          Cargando el detalle de la jornada.
        </span>
      </div>
    )
  }

  if (detailQuery.isError && !detailQuery.data) {
    return (
      <InlineAlert tone="error" title="No pudimos cargar la jornada">
        {isApiError(detailQuery.error)
          ? detailQuery.error.message
          : 'Inténtalo de nuevo en unos segundos.'}
      </InlineAlert>
    )
  }

  const session = detailQuery.data?.session
  const autoCloseNotice = session?.autoCloseNotice

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit((payload) => mutation.mutate(payload))}
    >
      {autoCloseNotice ? (
        <InlineAlert tone="warning" title="Cierre automático detectado">
          {autoCloseNotice.message} Si la hora real fue otra, corrígela aquí y quedará todo alineado.
        </InlineAlert>
      ) : null}

      <div className="rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.22),_rgb(18_24_33_/_0.44))] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <TimeField
            label="Entrada"
            error={form.formState.errors.startTime?.message}
            {...form.register('startTime')}
          />
          <TimeField
            label="Salida"
            error={form.formState.errors.endTime?.message}
            {...form.register('endTime')}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-nuba-text-muted/70">
          <span>{session?.endTime ? 'Corrige la salida si hace falta.' : 'Déjala vacía si la jornada sigue abierta.'}</span>
          <span>
            {values.endTime
              ? `${formatMinutesCompact(summary.workedMinutes)} netos`
              : 'Jornada abierta'}
          </span>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.2),_rgb(18_24_33_/_0.4))] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-nuba-text">Descansos</p>
          <SecondaryButton
            type="button"
            className="px-3 py-2 text-xs"
            onClick={() =>
              append({
                breakType: 'LUNCH',
                startTime: '14:00',
                endTime: '14:30',
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir
          </SecondaryButton>
        </div>

        {fields.length ? (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.fieldId}
                className="rounded-[20px] border border-white/[0.06] bg-black/10 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <select
                    value={values.breaks?.[index]?.breakType ?? 'LUNCH'}
                    onChange={(event) =>
                      form.setValue(
                        `breaks.${index}.breakType`,
                        event.target.value as 'LUNCH' | 'OTHER',
                        { shouldDirty: true },
                      )
                    }
                    className="rounded-[14px] border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm font-medium text-nuba-text outline-none transition focus:border-nuba-brand/40"
                  >
                    <option value="LUNCH">{getBreakTypeLabel('LUNCH')}</option>
                    <option value="OTHER">{getBreakTypeLabel('OTHER')}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-nuba-text-muted/72 transition hover:border-nuba-check-out/28 hover:bg-nuba-check-out/10 hover:text-nuba-check-out"
                    aria-label="Eliminar descanso"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <TimeField
                    label="Inicio"
                    error={form.formState.errors.breaks?.[index]?.startTime?.message}
                    {...form.register(`breaks.${index}.startTime`)}
                  />
                  <TimeField
                    label="Fin"
                    error={form.formState.errors.breaks?.[index]?.endTime?.message}
                    {...form.register(`breaks.${index}.endTime`)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-4 text-sm text-nuba-text-muted/72">
            Sin descansos en esta jornada.
          </div>
        )}
      </div>

      <input
        type="text"
        {...form.register('notes')}
        className="w-full rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.8),_rgb(18_24_33_/_0.92))] px-3 py-3 text-sm text-nuba-text outline-none transition focus:border-nuba-brand/44"
        placeholder="Nota opcional"
      />

      {mutation.isError ? (
        <InlineAlert tone="error" title="No pudimos guardar los cambios">
          {isApiError(mutation.error)
            ? mutation.error.message
            : mutation.error instanceof Error
              ? mutation.error.message
              : 'Revisa los tiempos y vuelve a intentarlo.'}
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton type="button" onClick={onCancel}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton type="submit" loading={mutation.isPending}>
          Guardar cambios
        </PrimaryButton>
      </div>
    </form>
  )
}
