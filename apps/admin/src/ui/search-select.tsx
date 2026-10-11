'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Popover } from 'radix-ui';
import { useId, useRef, useState, type Ref } from 'react';
import { controlClasses, FieldFrame } from './field';
import { CheckIcon, GlobeIcon } from './icons';

interface Option {
  value: string;
  label: string;
  detail?: string;
}
interface SearchSelectProps {
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** A labelled combobox opening a searchable dialog; only choosing an option commits. */
export function SearchSelect({
  label,
  placeholder,
  options,
  value,
  onValueChange,
  onBlur,
  error,
  hint,
  disabled,
  ref,
}: SearchSelectProps) {
  const t = useTranslations('select');
  const dir = useLocale().startsWith('ar') ? 'rtl' : 'ltr';
  const id = useId();
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    `${option.label} ${option.detail ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
    onBlur?.();
  };
  const focusOption = (index: number) =>
    list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus();

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setQuery('');
          else onBlur?.();
        }}
      >
        <Popover.Trigger asChild>
          <button
            ref={ref}
            id={id}
            type="button"
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? `${id}-popup` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            disabled={disabled}
            className={`${controlClasses} search-select-trigger flex items-center gap-3 text-start`}
          >
            <GlobeIcon width={18} height={18} className="shrink-0 text-muted" />
            <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-muted'}`}>
              {selected?.label ?? placeholder}
            </span>
            {selected?.detail && (
              <span className="select-code" dir="ltr">
                {selected.detail}
              </span>
            )}
            <svg
              aria-hidden="true"
              className="select-chevron shrink-0 text-muted"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            id={`${id}-popup`}
            dir={dir}
            sideOffset={8}
            align="start"
            collisionPadding={16}
            className="select-popover z-[60]"
            aria-label={t('search')}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              search.current?.focus();
            }}
          >
            <div className="select-search">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 5 5" />
              </svg>
              <input
                ref={search}
                type="search"
                aria-label={t('search')}
                placeholder={t('searchPlaceholder')}
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && filtered.length) {
                    event.preventDefault();
                    focusOption(0);
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (filtered.length === 1) choose(filtered[0]!.value);
                  }
                }}
              />
            </div>
            <div ref={list} role="listbox" aria-label={label} className="select-options">
              {filtered.map((option, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  key={option.value}
                  tabIndex={index === 0 ? 0 : -1}
                  className="select-option"
                  onClick={() => choose(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      focusOption(
                        (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) %
                          filtered.length,
                      );
                    }
                    if (event.key === 'Home' || event.key === 'End') {
                      event.preventDefault();
                      focusOption(event.key === 'Home' ? 0 : filtered.length - 1);
                    }
                  }}
                >
                  <span className="min-w-0 flex-1 break-words text-start">{option.label}</span>
                  {option.detail && (
                    <span className="select-code" dir="ltr">
                      {option.detail}
                    </span>
                  )}
                  <span className="w-4 shrink-0">
                    {option.value === value && <CheckIcon width={16} height={16} />}
                  </span>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <p role="status" className="px-4 py-7 text-center text-sm text-muted">
                {t('empty')}
              </p>
            )}
            <div className="select-footer text-xs text-muted">
              {t('count', { count: filtered.length })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FieldFrame>
  );
}
