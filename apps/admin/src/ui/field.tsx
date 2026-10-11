import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from 'react';

const controlClasses = [
  'premium-control block w-full min-h-11 rounded-md border border-edge bg-surface px-3 text-base text-ink',
  'pointer-coarse:min-h-11 placeholder:text-muted',
  'aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger aria-invalid:focus-visible:outline-danger',
  'disabled:bg-sunken disabled:text-muted',
].join(' ');

interface FieldFrameProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

function FieldFrame({ id, label, hint, error, children, className = '' }: FieldFrameProps) {
  return (
    <div className={`grid content-start gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint: unknown, error: unknown) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
  frameClassName?: string;
}

export function TextField({
  label,
  hint,
  error,
  frameClassName,
  className = '',
  ...input
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} className={frameClassName}>
      <input
        id={id}
        className={`${controlClasses} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
    </FieldFrame>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
  frameClassName?: string;
}

/** Native select: accessible and comfortable on phones for short lists like countries. */
export function SelectField({
  label,
  hint,
  error,
  frameClassName,
  className = '',
  children,
  ...select
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} className={frameClassName}>
      <select
        id={id}
        className={`${controlClasses} pe-8 ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...select}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
