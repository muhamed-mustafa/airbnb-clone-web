'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { RowActions } from '@/features/locations/row-actions';
import { useListParams } from '@/features/locations/use-list-params';
import { Button } from '@/ui/button';
import { PlusIcon } from '@/ui/icons';
import { EmptyState } from '@/ui/states';
import { useDialog } from '@/ui/use-dialog';
import { useCountries, type Country } from './api';
// Forms (react-hook-form + zod) load when a dialog opens, not with the list.
const CountryFormDialog = dynamic(() =>
  import('./country-form-dialog').then((module) => module.CountryFormDialog),
);
const DeleteCountryDialog = dynamic(() =>
  import('./delete-country-dialog').then((module) => module.DeleteCountryDialog),
);

const FILTER_KEYS = ['name', 'code'] as const;

type DialogState =
  { type: 'create' } | { type: 'edit'; country: Country } | { type: 'delete'; country: Country };

export function CountriesScreen() {
  const t = useTranslations('countries');
  const tc = useTranslations('common');
  const { values, page, update, clear, hasFilters, resetToken } = useListParams(FILTER_KEYS);
  const dialog = useDialog<DialogState>();

  const query = useCountries({ page, name: values.name, code: values.code });
  const meta = query.data?.meta;
  const rows = query.data?.data ?? [];

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
          onClick={() => dialog.open({ type: 'create' })}
        >
          {t('add')}
        </Button>
      </div>

      <search className="grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-3 sm:grid-cols-[minmax(0,20rem)_8rem_auto]">
        <FilterInput
          resetToken={resetToken}
          label={t('searchName')}
          hint={t('searchNameHint')}
          value={values.name}
          isSendable={(value) => value === '' || value.length >= 3}
          onCommit={(name) => update({ name })}
          maxLength={50}
        />
        <FilterInput
          resetToken={resetToken}
          label={t('searchCode')}
          hint={t('searchCodeHint')}
          value={values.code}
          normalize={(value) => value.trim().toUpperCase()}
          isSendable={(value) => value === '' || /^[A-Z]{2}$/.test(value)}
          onCommit={(code) => update({ code })}
          maxLength={2}
          dir="ltr"
          className="font-mono uppercase"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            className="col-span-full justify-self-start sm:col-span-1 sm:mt-7"
            onClick={clear}
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
          ) : (
            <EmptyState
              title={t('emptyTitle')}
              body={t('emptyBody')}
              action={
                <Button
                  variant="primary"
                  icon={<PlusIcon width={18} height={18} />}
                  onClick={() => dialog.open({ type: 'create' })}
                >
                  {t('add')}
                </Button>
              }
            />
          )
        }
      >
        {/* Phones: one compact row per country. Wider screens: a table. */}
        <ul className="divide-y divide-hairline md:hidden">
          {rows.map((country) => (
            <li
              key={country.id}
              className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
            >
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="break-words">{country.name}</span>
                <span dir="ltr" className="font-mono text-xs text-muted">
                  {country.code}
                </span>
              </div>
              <RowActions
                name={country.name}
                onEdit={() => dialog.open({ type: 'edit', country })}
                onDelete={() => dialog.open({ type: 'delete', country })}
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
              <th scope="col" className="w-28 px-4 py-2.5 text-start font-semibold">
                {t('columnCode')}
              </th>
              <th scope="col" className="w-48 px-4 py-2.5 text-end font-semibold">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((country) => (
              <tr key={country.id} className="h-14 hover:bg-ground">
                <th scope="row" className="px-4 text-start font-normal">
                  {country.name}
                </th>
                <td className="px-4 font-mono text-muted">
                  <span dir="ltr">{country.code}</span>
                </td>
                <td className="px-4">
                  <RowActions
                    name={country.name}
                    onEdit={() => dialog.open({ type: 'edit', country })}
                    onDelete={() => dialog.open({ type: 'delete', country })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      {dialog.value?.type === 'create' && (
        <CountryFormDialog onClose={dialog.close} returnFocusTo={dialog.opener} />
      )}
      {dialog.value?.type === 'edit' && (
        <CountryFormDialog
          country={dialog.value.country}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
      {dialog.value?.type === 'delete' && (
        <DeleteCountryDialog
          country={dialog.value.country}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
    </div>
  );
}
