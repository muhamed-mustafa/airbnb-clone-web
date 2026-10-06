'use client';

import { useRef, useState, type InputHTMLAttributes } from 'react';
import { TextField } from '@/ui/field';

interface FilterInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'defaultValue'
> {
  label: string;
  hint: string;
  /** The value currently applied (from the URL). */
  value: string;
  /** Normalizes what is sent (trim, uppercase). */
  normalize?: (value: string) => string;
  /** The backend rejects values it cannot search (e.g. names under 3 characters). */
  isSendable: (value: string) => boolean;
  onCommit: (value: string) => void;
}

/**
 * Text filter that applies its value 350 ms after typing stops, and only when the backend
 * can search it. When the applied value changes from outside (Clear filters, Back), the
 * field follows it.
 */
export function FilterInput({
  label,
  hint,
  value,
  normalize = (text) => text.trim(),
  isSendable,
  onCommit,
  ...input
}: FilterInputProps) {
  const [draft, setDraft] = useState({ applied: value, text: value });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Adjust state while rendering (react.dev "storing information from previous renders").
  if (value !== draft.applied) {
    const ownCommit = normalize(draft.text) === value;
    setDraft({ applied: value, text: ownCommit ? draft.text : value });
  }

  return (
    <TextField
      label={label}
      hint={hint}
      value={draft.text}
      type="search"
      onChange={(event) => {
        const text = event.target.value;
        setDraft((current) => ({ ...current, text }));
        clearTimeout(timer.current);
        const normalized = normalize(text);
        if (!isSendable(normalized) || normalized === value) return;
        timer.current = setTimeout(() => onCommit(normalized), 350);
      }}
      {...input}
    />
  );
}
