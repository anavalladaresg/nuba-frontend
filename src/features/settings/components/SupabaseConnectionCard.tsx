import { Database, LoaderCircle, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { SecondaryButton } from '../../../shared/ui/buttons/Button'
import { SectionCard } from '../../../shared/ui/cards/SectionCard'
import { InlineAlert } from '../../../shared/ui/feedback/InlineAlert'
import { formatDateTime } from '../../../shared/utils/format'
import { useSupabaseHealthCheck } from '../hooks/useSupabaseHealthCheck'
import { cn } from '../../../shared/utils/cn'

const statusBadgeClassName = {
  ready: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  degraded: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
} as const

export function SupabaseConnectionCard() {
  const healthQuery = useSupabaseHealthCheck()

  const report = healthQuery.data

  return (
    <SectionCard
      title="Supabase directo"
      description="Conexión frontend-first para el prototipo de Nuba, separada por servicios para que luego podamos migrar a una API propia sin reescribir la UI."
      actions={
        <SecondaryButton
          onClick={() => void healthQuery.refetch()}
          disabled={healthQuery.isFetching}
        >
          {healthQuery.isFetching ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Revalidar
        </SecondaryButton>
      }
    >
      {healthQuery.isLoading ? (
        <div className="rounded-[24px] border border-white/8 bg-nuba-surface-elevated/70 p-5 text-sm text-nuba-text-muted">
          <div className="inline-flex items-center gap-2 text-nuba-text">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Comprobando la conexión con Supabase y las tablas reales de Nuba.
          </div>
        </div>
      ) : null}

      {healthQuery.isError ? (
        <InlineAlert tone="error" title="No pudimos validar Supabase">
          {healthQuery.error instanceof Error
            ? healthQuery.error.message
            : 'La validación de Supabase ha fallado por un error desconocido.'}
        </InlineAlert>
      ) : null}

      {report ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/8 bg-nuba-surface-elevated/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-nuba-text-muted/70">
                Estado
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
                    statusBadgeClassName[report.connectionStatus],
                  )}
                >
                  {report.connectionStatus}
                </span>
                <span className="text-sm text-nuba-text-muted">
                  {report.projectReachable ? 'Proyecto alcanzable' : 'Sin acceso confirmado'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-nuba-text-muted">{report.summary}</p>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-nuba-surface-elevated/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-nuba-text-muted/70">
                Proyecto
              </p>
              <div className="mt-3 flex items-center gap-2 text-nuba-text">
                <Database className="h-4 w-4 text-nuba-brand" />
                <span className="text-sm font-medium">{report.projectHost}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-nuba-text-muted">
                Modo actual: <span className="font-medium text-nuba-text">{report.mode}</span>
              </p>
              <p className="mt-1 text-sm leading-6 text-nuba-text-muted">
                Última revisión: {formatDateTime(report.checkedAt)}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-nuba-surface-elevated/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-nuba-text-muted/70">
                Uso previsto
              </p>
              <div className="mt-3 inline-flex items-center gap-2 text-nuba-text">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-medium">Frontend directo y migrable</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-nuba-text-muted">
                Cliente en <span className="font-medium text-nuba-text">src/lib</span> y acceso
                a datos encapsulado en <span className="font-medium text-nuba-text">src/services</span>.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {report.probes.map((probe) => (
              <article
                key={probe.key}
                className="rounded-[24px] border border-white/8 bg-nuba-surface-elevated/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-nuba-text">{probe.label}</p>
                    <p className="text-xs text-nuba-text-muted">{probe.target}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      probe.status === 'ok' && 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
                      probe.status === 'blocked' && 'border-amber-300/20 bg-amber-300/10 text-amber-200',
                      probe.status === 'error' && 'border-rose-400/20 bg-rose-400/10 text-rose-200',
                    )}
                  >
                    {probe.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-nuba-text-muted">{probe.message}</p>
                <p className="mt-2 text-sm font-medium text-nuba-text">
                  {probe.count !== null ? `${probe.count} registros` : 'Sin conteo disponible'}
                </p>
              </article>
            ))}
          </div>

          <div className="rounded-[24px] border border-white/8 bg-nuba-surface-elevated/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-nuba-text">
                  Demo real sobre sesiones de trabajo
                </p>
                <p className="text-sm leading-6 text-nuba-text-muted">
                  Vista de ejemplo preparada para evolucionar luego a historial y dashboard reales.
                </p>
              </div>
            </div>

            {report.recentWorkSessions.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {report.recentWorkSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-nuba-text-muted/68">
                      {session.workDate}
                    </p>
                    <p className="mt-2 text-base font-semibold text-nuba-text">{session.status}</p>
                    <p className="mt-2 text-sm leading-6 text-nuba-text-muted">
                      Trabajo {session.workedMinutes}m · Comida {session.breakMinutes}m · Extra{' '}
                      {session.extraMinutes}m
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 inline-flex items-start gap-2 rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm leading-6 text-nuba-text-muted">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                No hemos podido leer una muestra de `work_sessions` o todavía no hay registros
                accesibles con la configuración actual.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}
