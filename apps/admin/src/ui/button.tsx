import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SpinnerIcon } from './icons';

/**
 * primary: the one main action of a page or dialog. secondary: everything else that matters.
 * ghost: low-emphasis chrome. danger: confirming a destruction (dialogs only).
 * edit / delete: row actions, quiet until hovered so data stays the strongest element.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'edit' | 'delete';
type Size = 'md' | 'sm';

export const buttonClasses = (variant: Variant = 'secondary', extra = '', size: Size = 'md') =>
  ['ui-button', `btn-${variant}`, size === 'sm' ? 'size-sm' : '', extra].filter(Boolean).join(' ');

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Replaces the label while loading, e.g. "Saving…". */
  loadingLabel?: ReactNode;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
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
      className={buttonClasses(variant, className, size)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <SpinnerIcon width={16} height={16} /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
