'use client';

import { Dialog as DialogPrimitive, Select as SelectPrimitive } from 'radix-ui';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AppliedFilters } from '@/features/locations/applied-filters';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { useListParams } from '@/features/locations/use-list-params';
import { Button } from '@/ui/button';
import { DateFilter } from '@/ui/date-filter';
import { CloseIcon } from '@/ui/icons';
import { ListRow } from '@/ui/list-row';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
import { useAdminUnit } from '@/features/units/api';
import { useAdminBookings, type AdminBooking, type BookingStatus } from './api';

const FILTER_KEYS = [
  'status',
  'search',
  'checkInFrom',
  'checkInTo',
  'createdFrom',
  'createdTo',
] as const;
const STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED'];

const utcDate = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`);

function BookingDetails({ booking, onClose }: { booking: AdminBooking; onClose: () => void }) {
  const t = useTranslations('bookings');
  const tc = useTranslations('common');
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: booking.currency });
  const unitQuery = useAdminUnit(booking.unit);
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      utcDate(value),
    );
  const fields: [string, string][] = [
    [t('unit'), booking.unitTitle ?? unitQuery.data?.title ?? t('unknownUnit')],
    [t('guest'), booking.guestName ?? t('unknownPerson')],
    [t('host'), booking.hostName ?? t('unknownPerson')],
    [t('columnStay'), `${date(booking.checkIn)} – ${date(booking.checkOut)}`],
    [
      t('columnGuests'),
      `${t('adults', { count: booking.adultsCount })}${booking.kidsCount ? ` · ${t('children', { count: booking.kidsCount })}` : ''}`,
    ],
    [t('nights', { count: booking.daysCount }), money.format(booking.pricePerDay)],
    [t('subtotal'), money.format(booking.bookingAmount)],
    [t('vat', { rate: booking.vat }), money.format(booking.vatAmount)],
    [
      t('created'),
      new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(booking.createdAt),
      ),
    ],
    [
      t('updated'),
      new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(booking.updatedAt),
      ),
    ],
  ];
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="dialog-enter fixed inset-y-0 end-0 z-50 w-[min(42rem,100vw)] overflow-y-auto bg-surface p-5 shadow-2xl sm:p-8"
        >
          <header className="flex items-start justify-between gap-4 border-b border-hairline pb-5">
            <div className="grid gap-2">
              <DialogPrimitive.Title className="text-xl font-semibold">
                {booking.unitTitle ?? t('details')}
              </DialogPrimitive.Title>
              <p className="text-sm text-muted">{booking.guestName ?? t('unknownPerson')}</p>
              <span
                className="role-badge w-fit"
                data-super={booking.status === 'CONFIRMED' || undefined}
              >
                {t(booking.status)}
              </span>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" className="icon-only" aria-label={tc('close')}>
                <CloseIcon />
              </Button>
            </DialogPrimitive.Close>
          </header>
          <section className="my-5 flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4">
            <div className="grid gap-1">
              <p className="text-xs text-muted">{t('columnTotal')}</p>
              <p className="text-2xl font-semibold tabular">{money.format(booking.totalAmount)}</p>
            </div>
            <p className="max-w-44 text-end text-sm text-muted">
              {date(booking.checkIn)} – {date(booking.checkOut)}
            </p>
          </section>
          <dl className="grid gap-3 py-6 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label} className="grid gap-1 rounded-lg border border-hairline p-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd dir="auto" className="break-all text-sm font-medium">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {booking.notes && (
            <section className="grid gap-1 border-t border-hairline py-4">
              <h3 className="text-sm font-semibold">{t('notes')}</h3>
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted">{booking.notes}</p>
            </section>
          )}
          {booking.cancellationReason && (
            <section className="grid gap-1 border-t border-hairline py-4">
              <h3 className="text-sm font-semibold">{t('cancellationReason')}</h3>
              <p className="text-sm leading-6 text-muted">{booking.cancellationReason}</p>
            </section>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function BookingsScreen() {
  const t = useTranslations('bookings');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { values, page, update, clear, hasFilters, resetToken } = useListParams(FILTER_KEYS);
  const [selected, setSelected] = useState<AdminBooking>();
  const query = useAdminBookings({ page, ...values });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const filters = FILTER_KEYS.filter((key) => values[key]).map((key) => ({
    key,
    label: t(key),
    value: key === 'status' ? t(values.status as BookingStatus) : values[key],
  }));
  const toolbar = (
    <div className="list-toolbar grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterInput
          resetToken={resetToken}
          label={t('search')}
          placeholder={t('searchPlaceholder')}
          hint={t('searchHint')}
          value={values.search}
          isSendable={(value) => value === '' || value.length >= 2}
          feedback={{ incomplete: () => t('searchHint'), waiting: t('filterReady') }}
          onCommit={(search) => update({ search })}
          maxLength={100}
        />
        <div className="field-frame grid content-start gap-1.5">
          <span className="field-label">{t('status')}</span>
          <SelectPrimitive.Root
            value={values.status || 'all'}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            onValueChange={(value) => update({ status: value === 'all' ? '' : value })}
          >
            <SelectPrimitive.Trigger
              className="ui-control booking-select-trigger"
              aria-label={t('status')}
            >
              <SelectPrimitive.Value />
              <SelectPrimitive.Icon aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Content
                className="booking-select-content"
                position="popper"
                sideOffset={6}
                collisionPadding={12}
              >
                <SelectPrimitive.Viewport>
                  <SelectPrimitive.Item className="booking-select-item" value="all">
                    <SelectPrimitive.ItemText>{t('anyStatus')}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="booking-select-check">
                      ✓
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                  {STATUSES.map((status) => (
                    <SelectPrimitive.Item
                      className="booking-select-item"
                      key={status}
                      value={status}
                    >
                      <SelectPrimitive.ItemText>{t(status)}</SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator className="booking-select-check">
                        ✓
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Viewport>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
        </div>
        {(['checkInFrom', 'checkInTo', 'createdFrom', 'createdTo'] as const).map((key) => (
          <DateFilter
            key={key}
            label={t(key)}
            value={values[key]}
            min={
              key === 'checkInTo'
                ? values.checkInFrom
                : key === 'createdTo'
                  ? values.createdFrom
                  : undefined
            }
            max={
              key === 'checkInFrom'
                ? values.checkInTo
                : key === 'createdFrom'
                  ? values.createdTo
                  : undefined
            }
            onChange={(value) => update({ [key]: value })}
          />
        ))}
      </div>
      <AppliedFilters filters={filters} onRemove={(key) => update({ [key]: '' })} onClear={clear} />
    </div>
  );

  return (
    <Page width="table">
      <PageHeader title={t('title')} summary={meta ? t('count', { count: meta.total }) : ' '} />
      <ListFrame
        toolbar={toolbar}
        isPending={query.isPending}
        error={query.error}
        meta={meta}
        isEmpty={rows.length === 0}
        loadingLabel={tc('loading')}
        isRefreshing={query.isPlaceholderData}
        onRetry={() => void query.refetch()}
        onPage={(next) => update({ page: next })}
        empty={
          <div className="booking-empty-state">
            <div className="booking-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <rect x="8.5" y="12" width="31" height="27" rx="6" />
                <path d="M16 8.5v7M32 8.5v7M9 20h30M17 27h5M17 32h12" />
                <circle cx="35.5" cy="34.5" r="7.5" />
                <path d="m32.5 34.5 2 2 4-4" />
              </svg>
            </div>
            <div className="grid justify-items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {hasFilters ? t('noResultsTitle') : t('emptyTitle')}
              </h2>
              <p className="max-w-sm text-sm leading-6 text-muted">
                {hasFilters ? t('noResultsBody') : t('emptyBody')}
              </p>
            </div>
            {hasFilters && (
              <Button variant="secondary" size="sm" onClick={clear}>
                {tc('clearFilters')}
              </Button>
            )}
          </div>
        }
      >
        <ul className="md:hidden">
          {rows.map((booking) => (
            <ListRow
              key={booking.id}
              actions={
                <Button size="sm" onClick={() => setSelected(booking)}>
                  {tc('actions')}
                </Button>
              }
            >
              <div className="grid gap-1">
                <span className="font-semibold">{booking.guestName ?? t('unknownPerson')}</span>
                <span className="text-sm text-muted">
                  {booking.unitTitle ?? t('unknownUnit')} · {t(booking.status)}
                </span>
                <span className="text-sm">
                  {dateFormat.format(utcDate(booking.checkIn))} –{' '}
                  {dateFormat.format(utcDate(booking.checkOut))}
                </span>
                <span className="text-sm font-semibold tabular">
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: booking.currency,
                  }).format(booking.totalAmount)}
                </span>
              </div>
            </ListRow>
          ))}
        </ul>
        <table className="data-table hidden md:table">
          <thead>
            <tr>
              <th scope="col">{t('columnBooking')}</th>
              <th scope="col">{t('columnUnit')}</th>
              <th scope="col">{t('columnStay')}</th>
              <th scope="col">{t('columnGuests')}</th>
              <th scope="col">{t('columnTotal')}</th>
              <th scope="col">{t('columnCreated')}</th>
              <th scope="col">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((booking) => (
              <tr key={booking.id}>
                <th scope="row">
                  <span className="flex items-center gap-2">
                    <span
                      className="role-badge"
                      data-super={booking.status === 'CONFIRMED' || undefined}
                    >
                      {t(booking.status)}
                    </span>
                    <span className="font-semibold">{booking.guestName ?? t('unknownPerson')}</span>
                  </span>
                </th>
                <td className="max-w-56 truncate">{booking.unitTitle ?? t('unknownUnit')}</td>
                <td className="whitespace-nowrap">
                  {dateFormat.format(utcDate(booking.checkIn))} –{' '}
                  {dateFormat.format(utcDate(booking.checkOut))}
                </td>
                <td className="tabular">{booking.adultsCount + (booking.kidsCount ?? 0)}</td>
                <td className="tabular">
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: booking.currency,
                  }).format(booking.totalAmount)}
                </td>
                <td className="whitespace-nowrap text-sm text-muted">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(booking.createdAt),
                  )}
                </td>
                <td>
                  <Button size="sm" onClick={() => setSelected(booking)}>
                    {t('details')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
      {selected && <BookingDetails booking={selected} onClose={() => setSelected(undefined)} />}
    </Page>
  );
}
