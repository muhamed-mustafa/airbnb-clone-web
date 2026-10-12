'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { onNavigationStart } from '@/lib/navigation-start';
import { TextField } from '@/ui/field';
import { CloseIcon, SearchIcon } from '@/ui/icons';

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
  delayMs?: number;
  feedback?: { incomplete: (text: string) => string; waiting: string };
}

/**
 * Text filter that applies its value 250 ms after typing stops, and only when the backend
 * can search it. A pending search is cancelled when a navigation starts (link click,
 * Back/Forward: before the router commits it, so a slow navigation is never overridden),
 * on unmount, on "Clear filters", and when the applied value changes from outside; the
 * field then follows the URL.
 */
export function FilterInput({
  label,
  hint,
  value,
  resetToken,
  normalize = (text) => text.trim(),
  isSendable,
  onCommit,
  delayMs = 250,
  feedback,
  ...input
}: FilterInputProps) {
  const t = useTranslations('listInteraction');
  const [draft, setDraft] = useState({ applied: value, text: value, token: resetToken });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  /** The last value this field applied itself; anything else arriving is external. */
  const ownCommit = useRef(value);

  // Adjust state while rendering (react.dev "storing information from previous renders").
  if (value !== draft.applied || resetToken !== draft.token) {
    const keepText = resetToken === draft.token && normalize(draft.text) === value;
    setDraft({ applied: value, text: keepText ? draft.text : value, token: resetToken });
  }

  // Timers are an external system: cancel them where the draft stops being relevant.
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(
    () =>
      onNavigationStart(() => {
        clearTimeout(timer.current);
        setDraft((current) => ({ ...current, text: current.applied }));
      }),
    [],
  );
  useEffect(() => {
    clearTimeout(timer.current);
  }, [resetToken]);
  useEffect(() => {
    if (value !== ownCommit.current) {
      clearTimeout(timer.current);
      ownCommit.current = value;
    }
  }, [value]);

  const normalizedDraft = normalize(draft.text);
  const pendingDraft = normalizedDraft !== value;
  const liveHint = pendingDraft
    ? isSendable(normalizedDraft)
      ? (feedback?.waiting ?? t('preparing'))
      : (feedback?.incomplete(normalizedDraft) ?? t('notApplied', { hint }))
    : hint;

  const clearDraft = () => {
    clearTimeout(timer.current);
    setDraft((current) => ({ ...current, text: '' }));
    ownCommit.current = '';
    if (value) onCommit('');
    inputRef.current?.focus();
  };

  return (
    <TextField
      ref={inputRef}
      label={label}
      hint={<span aria-live="polite">{liveHint}</span>}
      value={draft.text}
      type="search"
      startAdornment={<SearchIcon width={17} height={17} />}
      endAdornment={
        draft.text ? (
          <button
            type="button"
            className="filter-clear grid h-9 w-9 place-items-center rounded-md text-muted"
            aria-label={t('clearSearch')}
            title={label}
            onClick={clearDraft}
          >
            <CloseIcon width={15} height={15} />
          </button>
        ) : undefined
      }
      onChange={(event) => {
        const text = event.target.value;
        setDraft((current) => ({ ...current, text }));
        clearTimeout(timer.current);
        const normalized = normalize(text);
        if (!isSendable(normalized) || normalized === value) return;
        timer.current = setTimeout(() => {
          ownCommit.current = normalized;
          onCommit(normalized);
        }, delayMs);
      }}
      {...input}
    />
  );
}
