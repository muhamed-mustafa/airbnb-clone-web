'use client';

import { Popover } from 'radix-ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ChevronNextIcon } from './icons';

const asDate = (value: string) => new Date(`${value}T00:00:00Z`);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function DateFilter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const locale = useLocale() === 'ar' ? 'ar-u-nu-latn' : 'en';
  const t = useTranslations('bookings');
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const date = value ? asDate(value) : new Date();
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  });
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - first.getUTCDay()));
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    return day;
  });
  const today = isoDate(new Date());
  const selected = value ? asDate(value) : undefined;
  const formatMonth = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const formatDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2023, 0, index + 1)),
    ),
  );

  return (
    <div className="field-frame grid content-start gap-1.5">
      <span className="field-label">{label}</span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className="ui-control date-filter-trigger" aria-label={label}>
            <span className={value ? '' : 'text-muted'}>
              {selected ? formatDate.format(selected) : t('datePlaceholder')}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-[17px] text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
              <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
            </svg>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="date-calendar"
            align="start"
            sideOffset={7}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="date-calendar-header">
              <button
                type="button"
                className="date-calendar-nav"
                aria-label={t('previousMonth')}
                onClick={() => setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))}
              >
                <ChevronNextIcon className="size-4 rotate-180 rtl:rotate-0" />
              </button>
              <p aria-live="polite" className="font-semibold">
                {formatMonth.format(month)}
              </p>
              <button
                type="button"
                className="date-calendar-nav"
                aria-label={t('nextMonth')}
                onClick={() => setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))}
              >
                <ChevronNextIcon className="size-4 rtl:rotate-180" />
              </button>
            </div>
            <div className="date-calendar-grid" role="grid" aria-label={formatMonth.format(month)}>
              {weekdays.map((weekday, index) => (
                <span
                  key={`${weekday}-${index}`}
                  className="date-calendar-weekday"
                  role="columnheader"
                >
                  {weekday}
                </span>
              ))}
              {days.map((day) => {
                const key = isoDate(day);
                const outsideMonth = day.getUTCMonth() !== monthIndex;
                const disabled = (min && key < min) || (max && key > max);
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-label={formatDate.format(day)}
                    aria-selected={key === value}
                    disabled={Boolean(disabled)}
                    data-outside={outsideMonth || undefined}
                    data-today={key === today || undefined}
                    className="date-calendar-day"
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                  >
                    {new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(
                      day,
                    )}
                  </button>
                );
              })}
            </div>
            <div className="date-calendar-footer">
              <button
                type="button"
                className="date-calendar-action"
                onClick={() =>
                  setMonth(
                    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
                  )
                }
              >
                {t('today')}
              </button>
              {value && (
                <button
                  type="button"
                  className="date-calendar-action"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  {t('clearDate')}
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
