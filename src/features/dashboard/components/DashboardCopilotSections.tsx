import type { ReactNode } from 'react'
import {
  Gauge,
  TrendingUp,
} from 'lucide-react'
import type { DashboardCopilotModel, Tone } from '../lib/dashboardCopilot'
import { cn } from '../../../shared/utils/cn'

const surfaceClassName =
  'relative overflow-hidden rounded-[32px] border border-[#2A3545]/78 bg-[linear-gradient(180deg,_rgb(18_24_33_/_0.94),_rgb(14_19_27_/_0.98))] shadow-[0_30px_80px_-42px_rgb(0_0_0_/_0.9)]'

const toneTextClassNames: Record<Tone, string> = {
  brand: 'text-nuba-brand',
  success: 'text-nuba-check-in',
  warning: 'text-nuba-break',
  violet: 'text-[#C7ABFF]',
  neutral: 'text-nuba-text-muted',
}

const toneChipClassNames: Record<Tone, string> = {
  brand: 'border-nuba-brand/18 bg-nuba-brand/10 text-nuba-brand',
  success: 'border-nuba-check-in/18 bg-nuba-check-in/10 text-nuba-check-in',
  warning: 'border-nuba-break/18 bg-nuba-break/10 text-nuba-break',
  violet: 'border-[#B388FF]/18 bg-[#B388FF]/10 text-[#C7ABFF]',
  neutral: 'border-white/8 bg-white/[0.04] text-nuba-text-muted/86',
}

const toneGlowClassNames: Record<Tone, string> = {
  brand:
    'before:bg-[radial-gradient(circle_at_top_right,_rgb(124_158_255_/_0.22),_transparent_56%)]',
  success:
    'before:bg-[radial-gradient(circle_at_top_right,_rgb(91_231_169_/_0.2),_transparent_56%)]',
  warning:
    'before:bg-[radial-gradient(circle_at_top_right,_rgb(255_209_102_/_0.18),_transparent_56%)]',
  violet:
    'before:bg-[radial-gradient(circle_at_top_right,_rgb(179_136_255_/_0.2),_transparent_56%)]',
  neutral:
    'before:bg-[radial-gradient(circle_at_top_right,_rgb(159_176_195_/_0.12),_transparent_60%)]',
}

const toneBarClassNames: Record<Tone, string> = {
  brand: 'from-nuba-brand via-[#91AEFF] to-[#C4D2FF]',
  success: 'from-nuba-check-in via-[#7EF1BF] to-[#C0F9DE]',
  warning: 'from-nuba-break via-[#FFE298] to-[#FFF0C7]',
  violet: 'from-[#B388FF] via-[#C7ABFF] to-[#E2D2FF]',
  neutral: 'from-white/18 via-white/14 to-white/10',
}

function InsightSurface({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: Tone
}) {
  return (
    <section
      className={cn(
        surfaceClassName,
        'before:pointer-events-none before:absolute before:inset-0',
        toneGlowClassNames[tone],
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </section>
  )
}

function ToneChip({
  children,
  tone,
}: {
  children: ReactNode
  tone: Tone
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold tracking-[0.06em]',
        toneChipClassNames[tone],
      )}
    >
      {children}
    </span>
  )
}

export function DashboardHeroCard({ hero }: Pick<DashboardCopilotModel, 'hero'>) {
  return (
    <InsightSurface tone={hero.tone} className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-[1.75rem] font-semibold leading-[1.08] tracking-[-0.05em] text-nuba-text sm:text-[2rem]">
            {hero.title}
          </h2>
          <p className="mt-2 max-w-[36rem] text-[0.94rem] leading-6 text-nuba-text-muted/84">
            {hero.body}
          </p>
        </div>
        {hero.metric && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-nuba-text-muted/56">
              {hero.metric.label}
            </p>
            <p className={cn('mt-1 text-xl font-bold tracking-[-0.03em]', toneTextClassNames[hero.metric.tone])}>
              {hero.metric.value}
            </p>
          </div>
        )}
      </div>
    </InsightSurface>
  )
}

export function DashboardHabitsCard({ habits }: Pick<DashboardCopilotModel, 'habits'>) {
  if (habits.items.length === 0) {
    return null
  }

  return (
    <InsightSurface className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-nuba-text-muted/54">
        Hábitos
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {habits.items.map((item) => (
          <article
            key={item.label}
            className="rounded-[24px] border border-white/7 bg-white/[0.02] px-3.5 py-3"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-nuba-text-muted/56">
              {item.label}
            </p>
            <p className={cn('mt-1.5 text-lg font-semibold tracking-[-0.03em]', toneTextClassNames[item.tone])}>
              {item.value}
            </p>
          </article>
        ))}
      </div>
    </InsightSurface>
  )
}

export function DashboardTrendCard({ trend }: Pick<DashboardCopilotModel, 'trend'>) {
  if (!trend) return null

  return (
    <InsightSurface className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-nuba-brand flex-shrink-0">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>

        <div className="flex-1 space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-nuba-text-muted/54">
            {trend.title}
          </p>
          <p className="text-[0.95rem] font-semibold leading-6 text-nuba-text">{trend.highlight}</p>
          <p className="text-sm leading-6 text-nuba-text-muted/80">{trend.interpretation}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5">
        {trend.bars.map((bar) => (
          <div
            key={bar.label}
            className="flex flex-1 flex-col items-center rounded-md overflow-hidden"
          >
            <div className="relative h-16 w-full bg-white/[0.02] rounded-md overflow-hidden">
              <div
                className={cn('absolute bottom-0 w-full transition-all duration-300', `bg-gradient-to-t ${toneBarClassNames[bar.tone]}`)}
                style={{
                  height: `${Math.max(bar.value, 5)}%`,
                }}
              />
              {bar.isCurrent && (
                <div className="absolute inset-0 border border-nuba-brand/50 rounded-md pointer-events-none" />
              )}
            </div>
            <span className={cn('mt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em]', bar.isCurrent ? 'text-nuba-text' : 'text-nuba-text-muted/68')}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </InsightSurface>
  )
}

export function DashboardConsistencyCard({
  consistency,
}: Pick<DashboardCopilotModel, 'consistency'>) {
  if (!consistency) return null

  return (
    <InsightSurface className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-[#C7ABFF] flex-shrink-0">
          <Gauge className="h-3.5 w-3.5" />
        </span>

        <div className="flex-1 space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-nuba-text-muted/54">
            Regularidad
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tracking-[-0.04em] text-[#C7ABFF]">
              {consistency.score}
              <span className="ml-1 text-sm text-nuba-text-muted/56">/100</span>
            </p>
          </div>
          <p className="text-sm leading-6 text-nuba-text-muted/80">
            {consistency.interpretation}
          </p>
        </div>
      </div>
    </InsightSurface>
  )
}

