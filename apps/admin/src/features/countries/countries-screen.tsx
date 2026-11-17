'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { AppliedFilters } from '@/features/locations/applied-filters';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { RowActions } from '@/features/locations/row-actions';
import { useListParams } from '@/features/locations/use-list-params';
import { Button } from '@/ui/button';
import { PlusIcon } from '@/ui/icons';
import { ListRow } from '@/ui/list-row';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
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

  const addButton = (
    <Button
      variant="primary"
      icon={<PlusIcon width={18} height={18} />}
      onClick={() => dialog.open({ type: 'create' })}
    >
      {t('add')}
    </Button>
  );

  const toolbar = (
    <div className="list-toolbar grid gap-3">
      <search className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-start gap-3 sm:grid-cols-[minmax(0,20rem)_9rem]">
        <FilterInput
          resetToken={resetToken}
          label={t('searchName')}
          placeholder={t('searchPlaceholder')}
          delayMs={250}
          feedback={{
            incomplete: (text) => t('nameIncomplete', { count: Math.max(0, 3 - text.length) }),
            waiting: t('searchQueued'),
          }}
          hint={t('searchNameHint')}
          value={values.name}
          isSendable={(value) => value === '' || value.length >= 3}
          onCommit={(name) => update({ name })}
          maxLength={50}
        />
        <FilterInput
          resetToken={resetToken}
          label={t('searchCode')}
          placeholder={t('codeSearchPlaceholder')}
          delayMs={250}
          feedback={{ incomplete: () => t('codeIncomplete'), waiting: t('searchQueued') }}
          hint={t('searchCodeHint')}
          value={values.code}
          normalize={(value) => value.trim().toUpperCase()}
          isSendable={(value) => value === '' || /^[A-Z]{2}$/.test(value)}
          onCommit={(code) => update({ code })}
          maxLength={2}
          className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
      </search>
      <AppliedFilters
        filters={FILTER_KEYS.filter((key) => values[key]).map((key) => ({
          key,
          label: key === 'name' ? t('columnName') : t('columnCode'),
          value: values[key],
        }))}
        onRemove={(key) => update({ [key]: '' })}
        onClear={clear}
      />
    </div>
  );

  return (
    <Page width="table">
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
          ) : (
            <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
          )
        }
      >
        {/* Phones: one row per country. Wider screens: a table. */}
        <ul className="md:hidden">
          {rows.map((country) => (
            <ListRow
              key={country.id}
              actions={
                <RowActions
                  name={country.name}
                  onEdit={() => dialog.open({ type: 'edit', country })}
                  onDelete={() => dialog.open({ type: 'delete', country })}
                />
              }
            >
              <span className="flex items-center gap-2.5">
                <span dir="ltr" className="code-chip shrink-0">
                  {country.code}
                </span>
                <span className="min-w-0 font-semibold">{country.name}</span>
              </span>
            </ListRow>
          ))}
        </ul>
        <table className="data-table data-table-fixed hidden md:table">
          {/* Explicit proportions instead of a narrow page: the code is fixed, the name gets
              a bounded share, and the actions start right after it, so data and its actions
              stay together at any width. */}
          <colgroup>
            <col className="w-32" />
            <col className="w-[40%]" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t('columnCode')}</th>
              <th scope="col">{t('columnName')}</th>
              <th scope="col">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((country) => (
              <tr key={country.id}>
                <td>
                  <span dir="ltr" className="code-chip">
                    {country.code}
                  </span>
                </td>
                <th scope="row" className="font-semibold break-words">
                  {country.name}
                </th>
                <td className="whitespace-nowrap">
                  <RowActions
                    align="start"
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
    </Page>
  );
}
