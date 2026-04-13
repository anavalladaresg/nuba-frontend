type ToggleRowProps = {
  checked: boolean
  description?: string
  label: string
  name: string
  onChange: (checked: boolean) => void
}

export function ToggleRow({
  checked,
  description,
  label,
  name,
  onChange,
}: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-3xl border border-white/8 bg-nuba-surface-elevated/80 p-4">
      <div className="space-y-1">
        <span className="text-sm font-medium text-nuba-text">{label}</span>
        {description ? (
          <p className="text-sm leading-6 text-nuba-text-muted">{description}</p>
        ) : null}
      </div>

      <span className="relative mt-1 inline-flex items-center">
        <input
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-7 w-12 rounded-full border border-white/10 bg-nuba-bg transition peer-checked:border-nuba-brand/30 peer-checked:bg-nuba-brand/20" />
        <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-checked:bg-nuba-brand" />
      </span>
    </label>
  )
}
