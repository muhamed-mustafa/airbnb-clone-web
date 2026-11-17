'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AppliedFilters } from '@/features/locations/applied-filters';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { useListParams } from '@/features/locations/use-list-params';
import { Button } from '@/ui/button';
import { SelectField } from '@/ui/field';
import { CloseIcon } from '@/ui/icons';
import { ListRow } from '@/ui/list-row';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
import { EmptyState } from '@/ui/states';
import {
  useAdminUnit,
  useAdminUnitFilterOptions,
  useAdminUnits,
  useUnitReferenceNames,
  type AdminUnit,
} from './api';

const FILTER_KEYS = [
  'title',
  'isActive',
  'availability',
  'minPrice',
  'maxPrice',
  'country',
  'city',
  'unitCategory',
] as const;

function UnitDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations('units');
  const tc = useTranslations('common');
  const query = useAdminUnit(id);
  const unit = query.data;
  const references = useUnitReferenceNames(unit);
  const yesNo = (value: boolean) => (value ? t('yes') : t('no'));
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="dialog-enter fixed inset-y-0 end-0 z-50 w-[min(42rem,100vw)] overflow-y-auto bg-surface p-5 shadow-2xl sm:p-8"
        >
          <header className="flex items-start justify-between gap-4 border-b border-hairline pb-5">
            <div className="grid gap-1">
              <DialogPrimitive.Title className="text-xl font-semibold">
                {t('detailsTitle')}
              </DialogPrimitive.Title>
              {unit && <p className="text-sm text-muted">{unit.title}</p>}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" className="icon-only" aria-label={tc('close')}>
                <CloseIcon />
              </Button>
            </DialogPrimitive.Close>
          </header>
          {query.isPending ? (
            <p className="py-8 text-sm text-muted" role="status">
              {tc('loading')}
            </p>
          ) : query.error || !unit ? (
            <div className="grid gap-3 py-8" role="alert">
              <p className="text-sm text-danger">{t('noResultsBody')}</p>
              <Button onClick={() => void query.refetch()}>{tc('retry')}</Button>
            </div>
          ) : (
            <UnitDetailsContent unit={unit} t={t} yesNo={yesNo} references={references.data} />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function UnitDetailsContent({
  unit,
  t,
  yesNo,
  references,
}: {
  unit: AdminUnit;
  t: ReturnType<typeof useTranslations<'units'>>;
  yesNo: (value: boolean) => string;
  references?: { country: string; city: string; category: string };
}) {
  const fields = [
    [t('address'), unit.address],
    [
      t('location'),
      references ? `${references.country} / ${references.city}` : t('referenceUnavailable'),
    ],
    [t('category'), references?.category ?? t('referenceUnavailable')],
    [t('rooms'), String(unit.roomsCount)],
    [t('adults'), String(unit.adultsCount)],
    [t('children'), String(unit.kidsCount)],
    [t('internet'), yesNo(unit.hasInternetService)],
    [t('kitchen'), yesNo(unit.hasKitchen)],
    [t('garage'), yesNo(unit.hasPrivateGarage)],
    [t('availability'), unit.availability ? t('available') : t('unavailable')],
    [t('status'), unit.isActive ? t('active') : t('inactive')],
  ];
  return (
    <div className="grid gap-6 py-6">
      <section className="grid gap-4 rounded-2xl border border-hairline bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
            {references?.category ?? t('referenceUnavailable')}
          </p>
          <h2 className="text-2xl font-semibold leading-tight">{unit.title}</h2>
          <p className="text-sm text-muted">{unit.address}</p>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3 sm:text-end">
          <p className="text-xs text-muted">{t('columnPrice')}</p>
          <p className="text-lg font-semibold tabular">
            {unit.costPerDay.toLocaleString()}{' '}
            <span className="text-sm font-normal">/ {t('night')}</span>
          </p>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {unit.photos.map((photo) => (
          // These are user-provided remote photo URLs from the listing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo}
            src={photo}
            alt={unit.title}
            className="aspect-[4/3] w-full rounded-xl object-cover"
          />
        ))}
      </div>
      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">{t('description')}</h3>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted">{unit.description}</p>
      </section>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="grid gap-1 rounded-lg border border-hairline p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd dir="auto" className="break-all text-sm font-medium">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function UnitsScreen() {
  const t = useTranslations('units');
  const tc = useTranslations('common');
  const { values, page, update, clear, hasFilters, resetToken } = useListParams(FILTER_KEYS);
  const options = useAdminUnitFilterOptions(values.country);
  const [selectedId, setSelectedId] = useState<string>();
  const query = useAdminUnits({ page, ...values });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const filters = FILTER_KEYS.filter((key) => values[key]).map((key) => ({
    key,
    label: t(key === 'title' ? 'searchTitle' : key),
    value:
      key === 'isActive'
        ? values[key] === 'true'
          ? t('active')
          : t('inactive')
        : key === 'availability'
          ? values[key] === 'true'
            ? t('available')
            : t('unavailable')
          : key === 'country'
            ? (options.countries.find((item) => item.id === values[key])?.name ??
              t('referenceUnavailable'))
            : key === 'city'
              ? (options.cities.find((item) => item.id === values[key])?.name ??
                t('referenceUnavailable'))
              : key === 'unitCategory'
                ? (options.categories.find((item) => item.id === values[key])?.name ??
                  t('referenceUnavailable'))
                : values[key],
  }));
  const toolbar = (
    <div className="list-toolbar grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterInput
          resetToken={resetToken}
          label={t('searchTitle')}
          placeholder={t('searchPlaceholder')}
          hint={t('searchHint')}
          value={values.title}
          isSendable={(value) => value === '' || value.length >= 3}
          feedback={{ incomplete: () => t('searchHint'), waiting: t('searchHint') }}
          onCommit={(title) => update({ title })}
          maxLength={50}
        />
        <SelectField
          label={t('status')}
          value={values.isActive}
          onChange={(event) => update({ isActive: event.target.value })}
        >
          <option value="">{t('anyStatus')}</option>
          <option value="true">{t('active')}</option>
          <option value="false">{t('inactive')}</option>
        </SelectField>
        <SelectField
          label={t('availability')}
          value={values.availability}
          onChange={(event) => update({ availability: event.target.value })}
        >
          <option value="">{t('anyAvailability')}</option>
          <option value="true">{t('available')}</option>
          <option value="false">{t('unavailable')}</option>
        </SelectField>
        <SelectField
          label={t('countryFilter')}
          value={values.country}
          onChange={(event) => update({ country: event.target.value, city: '' })}
        >
          <option value="">{t('allCountries')}</option>
          {options.countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('cityFilter')}
          value={values.city}
          disabled={!values.country || options.citiesLoading}
          onChange={(event) => update({ city: event.target.value })}
        >
          <option value="">{values.country ? t('allCities') : t('chooseCountry')}</option>
          {options.cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('categoryFilter')}
          value={values.unitCategory}
          onChange={(event) => update({ unitCategory: event.target.value })}
        >
          <option value="">{t('allCategories')}</option>
          {options.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <label className="field-frame grid content-start gap-1.5">
          <span className="field-label">{t('minPrice')}</span>
          <input
            className="ui-control"
            type="number"
            min="1"
            inputMode="decimal"
            value={values.minPrice}
            onChange={(event) => update({ minPrice: event.target.value })}
          />
        </label>
        <label className="field-frame grid content-start gap-1.5">
          <span className="field-label">{t('maxPrice')}</span>
          <input
            className="ui-control"
            type="number"
            min="1"
            inputMode="decimal"
            value={values.maxPrice}
            onChange={(event) => update({ maxPrice: event.target.value })}
          />
        </label>
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
          <EmptyState
            title={hasFilters ? t('noResultsTitle') : t('emptyTitle')}
            body={hasFilters ? t('noResultsBody') : t('emptyBody')}
          />
        }
      >
        <ul className="md:hidden">
          {rows.map((unit) => (
            <ListRow
              key={unit.id}
              actions={
                <Button size="sm" onClick={() => setSelectedId(unit.id)}>
                  {t('viewDetails')}
                </Button>
              }
            >
              <div className="flex min-w-0 items-center gap-3">
                {unit.photos[0] && (
                  // These are user-provided remote photo URLs from the listing.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={unit.photos[0]}
                    alt=""
                    className="h-16 w-20 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="grid min-w-0 gap-1">
                  <span className="truncate font-semibold">{unit.title}</span>
                  <span className="text-sm text-muted">
                    {unit.costPerDay.toLocaleString()} · {t('columnPrice')}
                  </span>
                  <span className="text-xs text-muted">
                    {unit.isActive ? t('active') : t('inactive')} ·{' '}
                    {unit.availability ? t('available') : t('unavailable')}
                  </span>
                </div>
              </div>
            </ListRow>
          ))}
        </ul>
        <table className="data-table hidden md:table">
          <thead>
            <tr>
              <th scope="col">{t('columnUnit')}</th>
              <th scope="col">{t('columnPrice')}</th>
              <th scope="col">{t('columnCapacity')}</th>
              <th scope="col">{t('columnStatus')}</th>
              <th scope="col">{t('columnAvailability')}</th>
              <th scope="col">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((unit) => (
              <tr key={unit.id}>
                <th scope="row" className="max-w-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    {unit.photos[0] && (
                      // These are user-provided remote photo URLs from the listing.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={unit.photos[0]}
                        alt=""
                        className="h-12 w-16 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{unit.title}</span>
                      <span className="block truncate text-xs text-muted">{unit.address}</span>
                    </span>
                  </span>
                </th>
                <td className="tabular">{unit.costPerDay.toLocaleString()}</td>
                <td className="tabular">{unit.adultsCount + unit.kidsCount}</td>
                <td>
                  <span className="role-badge" data-super={unit.isActive || undefined}>
                    {unit.isActive ? t('active') : t('inactive')}
                  </span>
                </td>
                <td>{unit.availability ? t('available') : t('unavailable')}</td>
                <td>
                  <Button size="sm" onClick={() => setSelectedId(unit.id)}>
                    {t('viewDetails')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
      {selectedId && <UnitDetails id={selectedId} onClose={() => setSelectedId(undefined)} />}
    </Page>
  );
}
