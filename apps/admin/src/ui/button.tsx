import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SpinnerIcon } from './icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'edit' | 'delete';

const VARIANTS: Record<Variant, string> = {
  primary:
    'premium-primary bg-accent text-white border-accent hover:bg-accent-strong hover:border-accent-strong',
  secondary: 'premium-secondary bg-surface text-ink border-edge hover:bg-sunken',
  edit: 'premium-edit',
  delete: 'premium-delete',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-sunken',
  danger: 'bg-danger text-white border-danger hover:bg-danger-strong hover:border-danger-strong',
};

export const buttonClasses = (variant: Variant = 'secondary', extra = '') =>
  [
    'premium-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold',
    'transition-colors pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    extra,
  ].join(' ');

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  /** Replaces the label while loading, e.g. "Saving…". */
  loadingLabel?: ReactNode;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  loading = false,
  loadingLabel,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <SpinnerIcon width={16} height={16} /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
