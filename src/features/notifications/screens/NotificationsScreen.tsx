import { useEffect } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { notificationsApi } from '../api/notifications.api'
import { notificationsKeys } from '../api/notifications.keys'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { queryClient } from '../../../shared/api/query-client'
import { ScreenHeader } from '../../../shared/ui/typography/ScreenHeader'
import { SectionCard } from '../../../shared/ui/cards/SectionCard'
import { ToggleRow } from '../../../shared/ui/forms/ToggleRow'
import { PrimaryButton } from '../../../shared/ui/buttons/Button'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'
import { ErrorState, LoadingState } from '../../../shared/ui/states/StateViews'
import { isApiError } from '../../../shared/api/api-error'

const notificationsFormSchema = z.object({
  smartRemindersEnabled: z.boolean(),
  remindStart: z.boolean(),
  remindPause: z.boolean(),
  remindStop: z.boolean(),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

export function NotificationsScreen() {
  const auth = useAuthSession()
  const notificationsQuery = useQuery({
    queryKey: notificationsKeys.settings(),
    queryFn: notificationsApi.getSettings,
    enabled: auth.isAuthenticated,
  })

  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      smartRemindersEnabled: true,
      remindStart: true,
      remindPause: false,
      remindStop: true,
    },
  })

  useEffect(() => {
    if (notificationsQuery.data) {
      form.reset(notificationsQuery.data)
    }
  }, [form, notificationsQuery.data])

  const mutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsKeys.settings() })
    },
  })

  const smartRemindersEnabled = useWatch({
    control: form.control,
    name: 'smartRemindersEnabled',
  })
  const remindStart = useWatch({
    control: form.control,
    name: 'remindStart',
  })
  const remindPause = useWatch({
    control: form.control,
    name: 'remindPause',
  })
  const remindStop = useWatch({
    control: form.control,
    name: 'remindStop',
  })

  if (notificationsQuery.isLoading && !notificationsQuery.data) {
    return (
      <LoadingState
        title="Cargando recordatorios"
        description="Preparando tus avisos."
      />
    )
  }

  if (notificationsQuery.isError && !notificationsQuery.data) {
    return (
      <ErrorState
        title="No pudimos cargar recordatorios"
        description={
          isApiError(notificationsQuery.error)
            ? notificationsQuery.error.message
            : 'Inténtalo de nuevo en unos segundos.'
        }
        onRetry={() => void notificationsQuery.refetch()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <ScreenHeader
        eyebrow="Recordatorios"
        title="Preferencias de avisos"
        description="Decide cuándo quieres que Nuba te ayude a no perder el control de la jornada."
      />

      <SectionCard
        title="Reglas de notificación"
        description="Avisos breves para entrada, pausa y cierre."
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <ToggleRow
            name="smartRemindersEnabled"
            label="Olvidos y objetivo diario"
            description="Detecta posibles despistes y te avisa al acercarte a la meta."
            checked={smartRemindersEnabled}
            onChange={(checked) => form.setValue('smartRemindersEnabled', checked)}
          />
          <ToggleRow
            name="remindStart"
            label="Avisar al empezar"
            checked={remindStart}
            onChange={(checked) => form.setValue('remindStart', checked)}
          />
          <ToggleRow
            name="remindPause"
            label="Pausa demasiado larga"
            checked={remindPause}
            onChange={(checked) => form.setValue('remindPause', checked)}
          />
          <ToggleRow
            name="remindStop"
            label="Recordatorio de salida"
            checked={remindStop}
            onChange={(checked) => form.setValue('remindStop', checked)}
          />

          <PrimaryButton type="submit" loading={mutation.isPending}>
            Guardar recordatorios
          </PrimaryButton>
        </form>
      </SectionCard>

      {mutation.isSuccess ? (
        <InlineAlert tone="success" title="Recordatorios guardados">
          Tus preferencias ya están actualizadas.
        </InlineAlert>
      ) : null}
    </div>
  )
}
