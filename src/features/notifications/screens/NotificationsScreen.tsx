import { useEffect, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { BellOff, BellRing, LoaderCircle, ShieldCheck, Smartphone } from 'lucide-react'
import { notificationsApi } from '../api/notifications.api'
import { notificationsKeys } from '../api/notifications.keys'
import { useAuthSession } from '../../auth/AuthSessionProvider'
import { queryClient } from '../../../shared/api/query-client'
import { ScreenHeader } from '../../../shared/ui/typography/ScreenHeader'
import { SectionCard } from '../../../shared/ui/cards/SectionCard'
import { ToggleRow } from '../../../shared/ui/forms/ToggleRow'
import { PrimaryButton, SecondaryButton } from '../../../shared/ui/buttons/Button'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'
import { ErrorState, LoadingState } from '../../../shared/ui/states/StateViews'
import { isApiError } from '../../../shared/api/api-error'
import {
  getCurrentPushSubscription,
  getPushConfigurationError,
  getPushPermission,
  isPushSupported,
  requiresStandalonePushActivation,
  isStandaloneWebApp,
  serializePushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../lib/pushNotifications'

const notificationsFormSchema = z.object({
  smartRemindersEnabled: z.boolean(),
  remindStart: z.boolean(),
  remindPause: z.boolean(),
  remindStop: z.boolean(),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

export function NotificationsScreen() {
  const auth = useAuthSession()
  const [pushOperationError, setPushOperationError] = useState<string | null>(null)
  const [pushOperationSuccess, setPushOperationSuccess] = useState<string | null>(null)
  const [isPushBusy, setIsPushBusy] = useState(false)
  const [browserPermission, setBrowserPermission] = useState(getPushPermission())
  const [browserSubscriptionEndpoint, setBrowserSubscriptionEndpoint] = useState<string | null>(null)
  const pushSupported = isPushSupported()
  const standalone = isStandaloneWebApp()
  const standaloneRequired = requiresStandalonePushActivation()
  const pushConfigError = getPushConfigurationError()
  const notificationsQuery = useQuery({
    queryKey: notificationsKeys.settings(),
    queryFn: notificationsApi.getSettings,
    enabled: auth.isAuthenticated,
  })
  const pushSubscriptionsQuery = useQuery({
    queryKey: notificationsKeys.pushSubscriptions(),
    queryFn: notificationsApi.getPushSubscriptions,
    enabled: auth.isAuthenticated && pushSupported,
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

  useEffect(() => {
    if (!pushSupported) {
      return
    }

    let cancelled = false

    const syncPushState = async () => {
      try {
        const subscription = await getCurrentPushSubscription()

        if (cancelled) {
          return
        }

        setBrowserPermission(getPushPermission())
        setBrowserSubscriptionEndpoint(subscription?.endpoint ?? null)
      } catch (error) {
        if (cancelled) {
          return
        }

        setPushOperationError(
          error instanceof Error
            ? error.message
            : 'No pudimos comprobar el estado actual de las notificaciones push.',
        )
      }
    }

    void syncPushState()

    return () => {
      cancelled = true
    }
  }, [pushSupported])

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
  const currentDeviceSubscription = pushSubscriptionsQuery.data?.items.find(
    (item) => item.endpoint === browserSubscriptionEndpoint,
  )

  const syncCurrentPushState = async () => {
    if (!pushSupported) {
      setBrowserPermission(getPushPermission())
      setBrowserSubscriptionEndpoint(null)
      return
    }

    const subscription = await getCurrentPushSubscription()
    setBrowserPermission(getPushPermission())
    setBrowserSubscriptionEndpoint(subscription?.endpoint ?? null)
  }

  const handleEnablePush = async () => {
    setIsPushBusy(true)
    setPushOperationError(null)
    setPushOperationSuccess(null)

    try {
      const subscription = await subscribeToPushNotifications()
      await notificationsApi.savePushSubscription(
        serializePushSubscription(subscription),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationsKeys.pushSubscriptions() }),
        syncCurrentPushState(),
      ])
      setPushOperationSuccess('Este dispositivo ya puede recibir recordatorios fuera de Nuba.')
    } catch (error) {
      setPushOperationError(
        error instanceof Error
          ? error.message
          : 'No pudimos activar las notificaciones push en este dispositivo.',
      )
    } finally {
      setIsPushBusy(false)
    }
  }

  const handleDisablePush = async () => {
    setIsPushBusy(true)
    setPushOperationError(null)
    setPushOperationSuccess(null)

    try {
      const endpoint = await unsubscribeFromPushNotifications()
      const endpointToDelete = endpoint ?? browserSubscriptionEndpoint

      if (endpointToDelete) {
        await notificationsApi.deletePushSubscription({ endpoint: endpointToDelete })
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationsKeys.pushSubscriptions() }),
        syncCurrentPushState(),
      ])
      setPushOperationSuccess('Las notificaciones push se han desactivado en este dispositivo.')
    } catch (error) {
      setPushOperationError(
        error instanceof Error
          ? error.message
          : 'No pudimos desactivar las notificaciones push en este dispositivo.',
      )
    } finally {
      setIsPushBusy(false)
    }
  }

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
        description="Activa Web Push para que Nuba pueda recordarte un desfichaje olvidado incluso con la app cerrada."
      />

      <SectionCard
        title="Notificaciones fuera de Nuba"
        description="El dispositivo quedará enlazado para recibir avisos reales cuando la jornada siga abierta."
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.32),_rgb(18_24_33_/_0.52))] px-4 py-3.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/54">
                Soporte
              </p>
              <p className="mt-1.5 inline-flex items-center gap-2 text-sm font-semibold text-nuba-text">
                <ShieldCheck className="h-4 w-4 text-nuba-brand" />
                {pushSupported ? 'Web Push disponible' : 'No compatible'}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.32),_rgb(18_24_33_/_0.52))] px-4 py-3.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/54">
                Estado del dispositivo
              </p>
              <p className="mt-1.5 inline-flex items-center gap-2 text-sm font-semibold text-nuba-text">
                <Smartphone className="h-4 w-4 text-nuba-brand" />
                {browserSubscriptionEndpoint ? 'Suscrito' : 'Sin activar'}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.22),_rgb(18_24_33_/_0.42))] px-4 py-3.5">
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/54">
              Permiso del sistema
            </p>
            <p className="mt-1.5 text-sm font-semibold text-nuba-text">
              {browserPermission === 'granted'
                ? 'Permitido'
                : browserPermission === 'denied'
                  ? 'Bloqueado'
                  : 'Pendiente de activar'}
            </p>
              <p className="mt-1 text-xs leading-5 text-nuba-text-muted/72">
              {standalone || !standaloneRequired
                ? 'Nuba ya puede pedir permiso directamente a este dispositivo.'
                : 'En iPhone y iPad necesitas abrir Nuba desde la pantalla de inicio para poder activar Web Push.'}
            </p>
          </div>

          {pushSubscriptionsQuery.data?.items.length ? (
            <div className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,_rgb(26_35_48_/_0.22),_rgb(18_24_33_/_0.42))] px-4 py-3.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/54">
                Suscripciones guardadas
              </p>
              <p className="mt-1.5 text-sm font-semibold text-nuba-text">
                {pushSubscriptionsQuery.data.items.length} dispositivo
                {pushSubscriptionsQuery.data.items.length === 1 ? '' : 's'} enlazado
                {pushSubscriptionsQuery.data.items.length === 1 ? '' : 's'}
              </p>
              {currentDeviceSubscription ? (
                <p className="mt-1 text-xs leading-5 text-nuba-text-muted/72">
                  Este dispositivo ya está registrado y listo para recibir recordatorios.
                </p>
              ) : null}
            </div>
          ) : null}

          {pushConfigError ? (
            <InlineAlert tone="error" title="Configuración pendiente">
              {pushConfigError}
            </InlineAlert>
          ) : null}

          {!standalone && standaloneRequired && pushSupported ? (
            <InlineAlert tone="warning" title="Abre Nuba desde la pantalla de inicio">
              En iPhone, Web Push solo funciona cuando la web app está instalada y abierta como app.
            </InlineAlert>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <PrimaryButton
              type="button"
              fullWidth
              loading={isPushBusy}
              disabled={
                !pushSupported || (standaloneRequired && !standalone) || Boolean(pushConfigError)
              }
              onClick={() => void handleEnablePush()}
            >
              <BellRing className="h-4 w-4" />
              {browserSubscriptionEndpoint ? 'Volver a vincular dispositivo' : 'Activar notificaciones push'}
            </PrimaryButton>

            <SecondaryButton
              type="button"
              fullWidth
              disabled={!browserSubscriptionEndpoint || isPushBusy}
              onClick={() => void handleDisablePush()}
            >
              {isPushBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
              Desactivar en este dispositivo
            </SecondaryButton>
          </div>
        </div>
      </SectionCard>

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

      {pushOperationSuccess ? (
        <InlineAlert tone="success" title="Dispositivo actualizado">
          {pushOperationSuccess}
        </InlineAlert>
      ) : null}

      {pushOperationError ? (
        <InlineAlert tone="error" title="No pudimos actualizar Web Push">
          {pushOperationError}
        </InlineAlert>
      ) : null}
    </div>
  )
}
