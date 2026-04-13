import type { PropsWithChildren } from 'react'

type FormFieldProps = PropsWithChildren<{
  label: string
  description?: string
  error?: string
}>

export function FormField({
  children,
  description,
  error,
  label,
}: FormFieldProps) {
  return (
    <label className="block space-y-2">
      <div className="space-y-1">
        <span className="text-sm font-medium text-nuba-text">{label}</span>
        {description ? (
          <p className="text-sm leading-6 text-nuba-text-muted">{description}</p>
        ) : null}
      </div>
      {children}
      {error ? <p className="text-sm text-nuba-error">{error}</p> : null}
    </label>
  )
}
