import { useEffect, useEffectEvent, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatches } from 'react-router-dom'
import { Bell, Sparkles } from 'lucide-react'
import type { UIMatch } from 'react-router-dom'
import { mobileNavItems, type AppRouteHandle, desktopNavItems } from '../navigation/routes'
import { NubaPillNav } from '../../shared/ui/navigation/NubaPillNav'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../shared/utils/cn'
import { env } from '../../config/env'
import { NUBA_LOGO_SRC } from '../../shared/brand/assets'

export type AppShellOutletContext = {
  setHomeSummaryMeta: (value: string | null) => void
}

const isRouteHandle = (handle: unknown): handle is AppRouteHandle => {
  if (!handle || typeof handle !== 'object') {
    return false
  }

  const routeHandle = handle as Partial<AppRouteHandle>
  return typeof routeHandle.title === 'string' && typeof routeHandle.description === 'string'
}

function NubaLogoMark({
  className,
  imageClassName,
}: {
  className?: string
  imageClassName?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-nuba-surface-elevated shadow-[0_16px_34px_-24px_rgb(124_158_255_/_0.9)]',
        className,
      )}
    >
      <img
        src={NUBA_LOGO_SRC}
        alt=""
        aria-hidden="true"
        className={cn('h-full w-full object-cover', imageClassName)}
      />
    </span>
  )
}

export function AppShell() {
  const location = useLocation()
  const matches = useMatches() as UIMatch[]
  const currentHandle = [...matches]
    .reverse()
    .map((match) => match.handle)
    .find(isRouteHandle)
  const isHomeRoute = location.pathname === '/'
  const isCalendarRoute = location.pathname === '/calendar'
  const isInsightsRoute = location.pathname === '/insights'
  const isSettingsRoute = location.pathname.startsWith('/settings')
  const usesCompactHeader = isCalendarRoute || isInsightsRoute || isSettingsRoute
  const [homeTimestamp, setHomeTimestamp] = useState(() => Date.now())
  const [homeSummaryMeta, setHomeSummaryMeta] = useState<string | null>(null)
  const updateHomeTimestamp = useEffectEvent(() => setHomeTimestamp(Date.now()))

  useEffect(() => {
    if (!isHomeRoute) {
      return undefined
    }

    updateHomeTimestamp()
    const intervalId = window.setInterval(() => updateHomeTimestamp(), 30_000)
    return () => window.clearInterval(intervalId)
  }, [isHomeRoute])

  useDocumentTitle(currentHandle?.title ?? 'Nuba')

  const currentClock = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: env.businessTimeZone,
  }).format(homeTimestamp)
  const homeMeta = homeSummaryMeta ?? `Hoy · ${currentClock}`

  return (
    <div className="min-h-screen bg-nuba-bg text-nuba-text">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-24 pt-1.5 sm:px-6 sm:pb-28 sm:pt-2.5 lg:px-8">
        <header
          className={cn(
            'sticky top-0 z-40',
            isHomeRoute
              ? 'backdrop-blur-xl mb-2.5 bg-nuba-bg/14 py-0.5 sm:mb-3 sm:py-1'
              : usesCompactHeader
                ? 'mb-2 bg-transparent py-1 sm:mb-3 sm:py-1.5'
                : 'backdrop-blur-xl mb-4 border-b border-white/5 bg-nuba-bg/80 py-3 sm:mb-6 sm:py-4',
          )}
        >
          {isHomeRoute ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Link to="/" aria-label="Ir a Hoy" className="mt-0.5">
                  <NubaLogoMark className="h-9 w-9 rounded-[1.05rem]" />
                </Link>
                <div className="space-y-px">
                  <Link
                    to="/"
                    className="inline-flex text-[1.12rem] font-semibold leading-none tracking-[-0.04em] text-nuba-text sm:text-[1.2rem]"
                  >
                    Nuba
                  </Link>
                  <p className="text-[0.72rem] font-medium leading-none tracking-[0.01em] text-nuba-text-muted/72">
                    {homeMeta}
                  </p>
                </div>
              </div>
            </div>
          ) : usesCompactHeader ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <Link to="/" aria-label="Ir a Hoy" className="mt-0.5">
                  <NubaLogoMark className="h-8 w-8 rounded-[0.95rem]" />
                </Link>
                <div className="space-y-0.5">
                  <Link
                    to="/"
                    className="inline-flex text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-nuba-text-muted/60"
                  >
                    Nuba
                  </Link>
                  <h1 className="text-[1.08rem] font-semibold tracking-[-0.045em] text-nuba-text sm:text-[1.22rem]">
                    {currentHandle?.title ?? 'Nuba'}
                  </h1>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-nuba-brand">
                  <NubaLogoMark className="h-9 w-9" />
                  Nuba
                </Link>

                <div className="space-y-0.5 sm:space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight text-nuba-text sm:text-3xl">
                    {currentHandle?.title ?? 'Control de jornada'}
                  </h1>
                  <p className="hidden max-w-2xl text-sm leading-6 text-nuba-text-muted sm:block sm:text-base">
                    {currentHandle?.description ??
                      'Frontend preparado para fichaje, control diario y seguimiento histórico.'}
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-3 lg:flex">
                <Link
                  to="/insights"
                  className="nuba-chip inline-flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Insights
                </Link>

                <Link
                  to="/settings/notifications"
                  className="nuba-chip inline-flex items-center gap-2"
                >
                  <Bell className="h-4 w-4" />
                  Recordatorios
                </Link>
              </div>
            </div>
          )}

          <nav
            className={cn(
              'hidden items-center gap-2 lg:flex',
              isHomeRoute ? 'mt-3' : usesCompactHeader ? 'mt-2' : 'mt-5',
            )}
          >
            {desktopNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-nuba-surface-elevated text-nuba-text shadow-nuba'
                      : 'text-nuba-text-muted hover:bg-nuba-surface/70 hover:text-nuba-text',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className={cn('flex min-h-0 flex-1 flex-col', isHomeRoute && 'overflow-hidden')}>
          <Outlet context={{ setHomeSummaryMeta }} />
        </main>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-50 px-4 pt-2 lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.9rem)' }}
      >
        <div className="pointer-events-auto mx-auto max-w-md">
          <NubaPillNav items={mobileNavItems} />
        </div>
      </div>
    </div>
  )
}
