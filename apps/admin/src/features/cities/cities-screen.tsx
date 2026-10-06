'use client';

import type { AppError } from '@stays/api-contract';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useCountryOptions } from '@/features/countries/api';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { RowActions } from '@/features/locations/row-actions';
import { useListParams } from '@/features/locations/use-list-params';
import { isBffError } from '@/lib/bff-client';
import { supportRequestId, useErrorText } from '@/lib/error-text';
import { Button, buttonClasses } from '@/ui/button';
import { ConfirmDialog } from '@/ui/dialog';
import { SelectField } from '@/ui/field';
import { PlusIcon } from '@/ui/icons';
import { EmptyState, FormAlert } from '@/ui/states';
import { useToast } from '@/ui/toast';
import { useDialog } from '@/ui/use-dialog';
import { useCities, useDeleteCity, type City } from './api';
// The form (react-hook-form + zod) loads when the dialog opens, not with the list.
const CityFormDialog = dynamic(() =>
  import('./city-form-dialog').then((module) => module.CityFormDialog),
);

const FILTER_KEYS = ['name', 'country'] as const;

type DialogState =
  { type: 'create' } | { type: 'edit'; city: City } | { type: 'delete'; city: City };

function DeleteCityDialog({
  city,
  onClose,
  returnFocusTo,
}: {
  city: City;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const t = useTranslations('cities');
  const tc = useTranslations('common');
  const notify = useToast();
  const { formTexts } = useErrorText();
  const remove = useDeleteCity();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  return (
    <ConfirmDialog
      open
      returnFocusTo={returnFocusTo}
      onOpenChange={(open) => !open && onClose()}
      title={t('deleteTitle', { name: city.name })}
      confirmLabel={t('deleteConfirm')}
      pendingLabel={tc('deleting')}
      pending={remove.isPending}
      onConfirm={() => {
        setAlert({ messages: [] });
        remove.mutate(city.id, {
          onSuccess: () => {
            notify(t('deleted', { name: city.name }));
            onClose();
          },
          onError: (error) => {
            const appError: AppError = isBffError(error)
              ? error.appError
              : { kind: 'unknown', formErrors: [], fieldErrors: {} };
            setAlert({ messages: formTexts(appError), requestId: supportRequestId(appError) });
          },
        });
      }}
    >
      <p>{t('deleteBody')}</p>
      <FormAlert messages={alert.messages} requestId={alert.requestId} />
    </ConfirmDialog>
  );
}

export function CitiesScreen() {
  const t = useTranslations('cities');
  const tc = useTranslations('common');
  const { values, page, update, hasFilters } = useListParams(FILTER_KEYS);
  const dialog = useDialog<DialogState>();

  const countries = useCountryOptions();
  const countryNames = useMemo(
    () => new Map((countries.data ?? []).map((country) => [country.id, country.name])),
    [countries.data],
  );
  const query = useCities({ page, name: values.name, country: values.country });
  const meta = query.data?.meta;
  const rows = query.data?.data ?? [];
  const noCountries = countries.isSuccess && countries.data.length === 0;
  const countryName = (id: string) =>
    countryNames.get(id) ?? (countries.isPending ? '…' : t('unknownCountry'));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="tabular text-sm text-muted" aria-live="polite">
            {meta ? t('count', { count: meta.total }) : ' '}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<PlusIcon width={18} height={18} />}
          disabled={!countries.isSuccess || noCountries}
          onClick={() => dialog.open({ type: 'create' })}
        >
          {t('add')}
        </Button>
      </div>

      <search className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,16rem)_auto]">
        <SelectField
          label={t('filterCountry')}
          value={values.country}
          onChange={(event) => update({ country: event.target.value })}
          disabled={!countries.isSuccess}
        >
          <option value="">{t('allCountries')}</option>
          {(countries.data ?? []).map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </SelectField>
        <FilterInput
          label={t('searchName')}
          hint={t('searchNameHint')}
          value={values.name}
          isSendable={(value) => value === '' || value.length >= 3}
          onCommit={(name) => update({ name })}
          maxLength={50}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            className="justify-self-start sm:mt-7"
            onClick={() => update({ name: '', country: '' })}
          >
            {tc('clearFilters')}
          </Button>
        )}
      </search>

      <ListFrame
        isPending={query.isPending}
        error={query.error}
        meta={meta}
        isEmpty={rows.length === 0}
        loadingLabel={tc('loading')}
        isRefreshing={query.isPlaceholderData}
        onRetry={() => void query.refetch()}
        onPage={(next) => update({ page: next })}
        empty={
          hasFilters ? (
            <EmptyState title={t('noResultsTitle')} body={t('noResultsBody')} />
          ) : noCountries ? (
            <EmptyState
              title={t('emptyTitle')}
              body={t('noCountriesBody')}
              action={
                <Link href="/locations/countries" className={buttonClasses('primary')}>
                  {t('goToCountries')}
                </Link>
              }
            />
          ) : (
            <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
          )
        }
      >
        <ul className="divide-y divide-hairline md:hidden">
          {rows.map((city) => (
            <li
              key={city.id}
              className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
            >
              <div className="grid min-w-0">
                <span className="break-words">{city.name}</span>
                <span className="text-xs text-muted break-words">{countryName(city.country)}</span>
              </div>
              <RowActions
                name={city.name}
                onEdit={() => dialog.open({ type: 'edit', city })}
                onDelete={() => dialog.open({ type: 'delete', city })}
              />
            </li>
          ))}
        </ul>
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-sunken text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                {t('columnName')}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                {t('columnCountry')}
              </th>
              <th scope="col" className="w-48 px-4 py-2.5 text-end font-semibold">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((city) => (
              <tr key={city.id} className="h-14 hover:bg-ground">
                <th scope="row" className="px-4 text-start font-normal">
                  {city.name}
                </th>
                <td className="px-4 text-muted">{countryName(city.country)}</td>
                <td className="px-4">
                  <RowActions
                    name={city.name}
                    onEdit={() => dialog.open({ type: 'edit', city })}
                    onDelete={() => dialog.open({ type: 'delete', city })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      {(dialog.value?.type === 'create' || dialog.value?.type === 'edit') && (
        <CityFormDialog
          city={dialog.value.type === 'edit' ? dialog.value.city : undefined}
          countries={countries.data ?? []}
          defaultCountry={values.country}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
      {dialog.value?.type === 'delete' && (
        <DeleteCityDialog
          city={dialog.value.city}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
    </div>
  );
}
