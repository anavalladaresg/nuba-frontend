import { cn } from '../../utils/cn'

type StatPillTone = 'default' | 'brand' | 'check-in' | 'break' | 'check-out' | 'overtime'

const toneClassName: Record<StatPillTone, string> = {
  default: 'border-white/8 bg-white/5 text-nuba-text',
  brand: 'border-nuba-brand/20 bg-nuba-brand/10 text-nuba-brand',
  'check-in': 'border-nuba-check-in/20 bg-nuba-check-in/10 text-nuba-check-in',
  break: 'border-nuba-break/20 bg-nuba-break/10 text-nuba-break',
  'check-out': 'border-nuba-check-out/20 bg-nuba-check-out/10 text-nuba-check-out',
  overtime: 'border-nuba-overtime/20 bg-nuba-overtime/10 text-nuba-overtime',
}

type StatPillProps = {
  label: string
  value: string
  tone?: StatPillTone
  className?: string
}

export function StatPill({
  className,
  label,
  tone = 'default',
  value,
}: StatPillProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-3',
        toneClassName[tone],
        className,
      )}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-inherit/70">{label}</p>
      <p className="mt-1 text-lg font-semibold text-nuba-text">{value}</p>
    </div>
  )
}
