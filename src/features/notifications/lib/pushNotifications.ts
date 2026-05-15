import { env } from '../../../config/env'
import type { PushSubscriptionPayload } from '../../../shared/types/notifications'

const PUSH_SERVICE_WORKER_PATH = '/push-sw.js'

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

const getNavigator = () =>
  typeof navigator === 'undefined' ? null : (navigator as NavigatorWithStandalone)

const getPlatform = () => {
  const userAgent = getNavigator()?.userAgent ?? ''

  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return 'ios'
  }

  if (/android/i.test(userAgent)) {
    return 'android'
  }

  if (userAgent) {
    return 'desktop'
  }

  return 'unknown'
}

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export const isStandaloneWebApp = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    getNavigator()?.standalone === true
  )
}

export const requiresStandalonePushActivation = () => getPlatform() === 'ios'

export const getPushPermission = () =>
  typeof Notification === 'undefined' ? 'default' : Notification.permission

export const getPushConfigurationError = () => {
  if (!env.webPushPublicKey) {
    return 'Falta configurar VITE_WEB_PUSH_PUBLIC_KEY para activar Web Push.'
  }

  return null
}

const urlBase64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}

export const ensurePushServiceWorkerRegistered = async () => {
  if (!isPushSupported()) {
    return null
  }

  const registration = await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_PATH)
  return registration.active ? registration : navigator.serviceWorker.ready
}

export const getCurrentPushSubscription = async () => {
  const registration = await ensurePushServiceWorkerRegistered()

  if (!registration) {
    return null
  }

  return registration.pushManager.getSubscription()
}

export const subscribeToPushNotifications = async () => {
  if (!isPushSupported()) {
    throw new Error('Este dispositivo no soporta Web Push.')
  }

  const configError = getPushConfigurationError()
  if (configError) {
    throw new Error(configError)
  }

  const registration = await ensurePushServiceWorkerRegistered()
  if (!registration) {
    throw new Error('No pudimos registrar el service worker de notificaciones.')
  }

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    return existing
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('Necesitamos permiso para poder enviarte recordatorios fuera de la app.')
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(env.webPushPublicKey),
  })
}

export const unsubscribeFromPushNotifications = async () => {
  const subscription = await getCurrentPushSubscription()

  if (!subscription) {
    return null
  }

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  return endpoint
}

export const serializePushSubscription = (
  subscription: PushSubscription,
): PushSubscriptionPayload => {
  const json = subscription.toJSON()

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('La suscripción push no devolvió las claves necesarias.')
  }

  return {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    userAgent: getNavigator()?.userAgent ?? null,
    platform: getPlatform(),
  }
}
