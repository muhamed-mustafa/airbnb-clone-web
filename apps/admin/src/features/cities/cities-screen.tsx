'use client';

import type { AppError } from '@stays/api-contract';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useCountryOptions } from '@/features/countries/api';
import { AppliedFilters } from '@/features/locations/applied-filters';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { RowActions } from '@/features/locations/row-actions';
import { useListParams } from '@/features/locations/use-list-params';
import { isBffError } from '@/lib/bff-client';
import { supportRequestId, useErrorText } from '@/lib/error-text';
import { Button, buttonClasses } from '@/ui/button';
import { ConfirmDialog } from '@/ui/dialog';
import { SearchSelect } from '@/ui/search-select';
import { PlusIcon } from '@/ui/icons';
import { ListRow } from '@/ui/list-row';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
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
  const { values, page, update, clear, hasFilters, resetToken } = useListParams(FILTER_KEYS);
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

  const addButton = (
    <Button
      variant="primary"
      icon={<PlusIcon width={18} height={18} />}
      disabled={!countries.isSuccess || noCountries}
      onClick={() => dialog.open({ type: 'create' })}
    >
      {t('add')}
    </Button>
  );

  const toolbar = (
    <div className="list-toolbar grid gap-3">
      <search className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,18rem)]">
        <SearchSelect
          label={t('filterCountry')}
          placeholder={t('allCountries')}
          options={[
            { value: '', label: t('allCountries') },
            ...(countries.data ?? []).map((country) => ({
              value: country.id,
              label: country.name,
              detail: country.code,
            })),
          ]}
          value={values.country}
          onValueChange={(country) => update({ country })}
          disabled={!countries.isSuccess}
        />
        <FilterInput
          resetToken={resetToken}
          label={t('searchName')}
          placeholder={t('searchPlaceholder')}
          hint={t('searchNameHint')}
          value={values.name}
          isSendable={(value) => value === '' || value.length >= 3}
          onCommit={(name) => update({ name })}
          maxLength={50}
        />
      </search>
      <AppliedFilters
        filters={[
          ...(values.country
            ? [{ key: 'country', label: t('filterCountry'), value: countryName(values.country) }]
            : []),
          ...(values.name ? [{ key: 'name', label: t('columnName'), value: values.name }] : []),
        ]}
        onRemove={(key) => update({ [key]: '' })}
        onClear={clear}
      />
    </div>
  );

  return (
    <Page width="wide">
      <PageHeader
        title={t('title')}
        summary={meta ? t('count', { count: meta.total }) : ' '}
        action={addButton}
      />

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
        <ul className="md:hidden">
          {rows.map((city) => (
            <ListRow
              key={city.id}
              actions={
                <RowActions
                  name={city.name}
                  onEdit={() => dialog.open({ type: 'edit', city })}
                  onDelete={() => dialog.open({ type: 'delete', city })}
                />
              }
            >
              <span className="font-semibold">{city.name}</span>
              <span className="text-xs text-muted">{countryName(city.country)}</span>
            </ListRow>
          ))}
        </ul>
        <table className="data-table data-table-fixed hidden md:table">
          {/* Two text columns of similar length share the width evenly; actions follow. */}
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[30%]" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t('columnName')}</th>
              <th scope="col">{t('columnCountry')}</th>
              <th scope="col">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((city) => (
              <tr key={city.id}>
                <th scope="row" className="font-semibold break-words">
                  {city.name}
                </th>
                <td className="text-muted break-words">{countryName(city.country)}</td>
                <td className="whitespace-nowrap">
                  <RowActions
                    align="start"
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
    </Page>
  );
}
