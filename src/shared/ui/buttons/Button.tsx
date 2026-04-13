import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    loading?: boolean
    fullWidth?: boolean
  }
>

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-nuba-brand bg-nuba-brand text-nuba-bg hover:brightness-110 disabled:border-nuba-brand/40 disabled:bg-nuba-brand/40',
  secondary:
    'border-white/10 bg-nuba-surface-elevated/90 text-nuba-text hover:border-nuba-brand/40 hover:text-nuba-brand disabled:bg-nuba-surface/60',
  danger:
    'border-nuba-check-out/40 bg-nuba-check-out/10 text-nuba-check-out hover:border-nuba-check-out hover:bg-nuba-check-out/20 disabled:border-nuba-check-out/20 disabled:text-nuba-check-out/40',
  ghost:
    'border-transparent bg-transparent text-nuba-text-muted hover:bg-white/5 hover:text-nuba-text',
}

export function Button({
  children,
  className,
  disabled,
  fullWidth,
  loading,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuba-brand disabled:cursor-not-allowed disabled:text-nuba-text-muted',
        fullWidth && 'w-full',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export const PrimaryButton = (props: Omit<ButtonProps, 'variant'>) => (
  <Button variant="primary" {...props} />
)

export const SecondaryButton = (props: Omit<ButtonProps, 'variant'>) => (
  <Button variant="secondary" {...props} />
)

export const DangerButton = (props: Omit<ButtonProps, 'variant'>) => (
  <Button variant="danger" {...props} />
)
