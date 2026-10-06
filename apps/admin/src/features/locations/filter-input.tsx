'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { TextField } from '@/ui/field';

interface FilterInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'defaultValue'
> {
  label: string;
  hint: string;
  /** The value currently applied (from the URL). */
  value: string;
  /** Changes when the list's filters are cleared; drops the draft and any pending search. */
  resetToken: number;
  /** Normalizes what is sent (trim, uppercase). */
  normalize?: (value: string) => string;
  /** The backend rejects values it cannot search (e.g. names under 3 characters). */
  isSendable: (value: string) => boolean;
  onCommit: (value: string) => void;
}

/**
 * Text filter that applies its value 350 ms after typing stops, and only when the backend
 * can search it. A pending search is cancelled on unmount, on "Clear filters", and when
 * the applied value changes from outside (Back/Forward); the field then follows the URL.
 */
export function FilterInput({
  label,
  hint,
  value,
  resetToken,
  normalize = (text) => text.trim(),
  isSendable,
  onCommit,
  ...input
}: FilterInputProps) {
  const [draft, setDraft] = useState({ applied: value, text: value, token: resetToken });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** The last value this field applied itself; anything else arriving is external. */
  const ownCommit = useRef(value);

  // Adjust state while rendering (react.dev "storing information from previous renders").
  if (value !== draft.applied || resetToken !== draft.token) {
    const keepText = resetToken === draft.token && normalize(draft.text) === value;
    setDraft({ applied: value, text: keepText ? draft.text : value, token: resetToken });
  }

  // Timers are an external system: cancel them where the draft stops being relevant.
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    clearTimeout(timer.current);
  }, [resetToken]);
  useEffect(() => {
    if (value !== ownCommit.current) {
      clearTimeout(timer.current);
      ownCommit.current = value;
    }
  }, [value]);

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
        timer.current = setTimeout(() => {
          ownCommit.current = normalized;
          onCommit(normalized);
        }, 350);
      }}
      {...input}
    />
  );
}
