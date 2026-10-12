import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from 'react';
import { AlertIcon } from './icons';

/** Every text input, select and select trigger shares this one control style (globals.css). */
export const controlClasses = 'ui-control';

interface FieldFrameProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  reserveMessageSpace?: boolean;
}

export function FieldFrame({
  id,
  label,
  hint,
  error,
  children,
  className = '',
  reserveMessageSpace,
}: FieldFrameProps) {
  return (
    <div className={`field-frame grid content-start gap-1.5 ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {(reserveMessageSpace || hint || error) && (
        <div className={reserveMessageSpace ? 'min-h-5' : undefined}>
          {hint && !error && (
            <p id={`${id}-hint`} className="field-hint">
              {hint}
            </p>
          )}
          {error && (
            <p id={`${id}-error`} aria-live="polite" className="field-error">
              <AlertIcon width={15} height={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const describedBy = (id: string, hint: unknown, error: unknown) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
  frameClassName?: string;
  reserveMessageSpace?: boolean;
}

export function TextField({
  startAdornment,
  endAdornment,
  label,
  hint,
  error,
  frameClassName,
  reserveMessageSpace,
  className = '',
  ...input
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={frameClassName}
      reserveMessageSpace={reserveMessageSpace}
    >
      <div className="relative" dir={input.dir}>
        <input
          id={id}
          className={`${controlClasses} ${endAdornment ? 'has-end-adornment' : ''} ${startAdornment ? 'has-start-adornment' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...input}
        />
        {startAdornment && (
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
            {startAdornment}
          </span>
        )}
        {endAdornment && (
          <span className="absolute inset-y-0 end-1 flex items-center">{endAdornment}</span>
        )}
      </div>
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
      <div className="relative">
        <select
          id={id}
          className={`${controlClasses} native-select ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...select}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </FieldFrame>
  );
}
