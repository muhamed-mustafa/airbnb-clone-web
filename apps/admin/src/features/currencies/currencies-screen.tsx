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
import { useCurrencies, type Currency } from './api';

// Forms (react-hook-form + zod) load when a dialog opens, not with the list.
const CurrencyFormDialog = dynamic(() =>
  import('./currency-form-dialog').then((module) => module.CurrencyFormDialog),
);
const DeleteCurrencyDialog = dynamic(() =>
  import('./delete-currency-dialog').then((module) => module.DeleteCurrencyDialog),
);

// URL keys match the backend's query parameters (unknown ones are rejected upstream).
const FILTER_KEYS = ['name', 'currencyCode'] as const;

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; currency: Currency }
  | { type: 'delete'; currency: Currency };

export function CurrenciesScreen() {
  const t = useTranslations('currencies');
  const tc = useTranslations('common');
  const { values, page, update, clear, hasFilters, resetToken } = useListParams(FILTER_KEYS);
  const dialog = useDialog<DialogState>();

  const query = useCurrencies({ page, name: values.name, currencyCode: values.currencyCode });
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
          hint={t('searchCodeHint')}
          value={values.currencyCode}
          normalize={(value) => value.trim().toUpperCase()}
          isSendable={(value) => value === '' || /^[A-Z]{3}$/.test(value)}
          onCommit={(currencyCode) => update({ currencyCode })}
          maxLength={3}
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
          ) : (
            <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
          )
        }
      >
        <ul className="md:hidden">
          {rows.map((currency) => (
            <ListRow
              key={currency.id}
              actions={
                <RowActions
                  name={currency.name}
                  onEdit={() => dialog.open({ type: 'edit', currency })}
                  onDelete={() => dialog.open({ type: 'delete', currency })}
                />
              }
            >
              <span className="flex items-center gap-2.5">
                <span dir="ltr" className="code-chip shrink-0">
                  {currency.currencyCode}
                </span>
                <span className="min-w-0 font-semibold">{currency.name}</span>
              </span>
            </ListRow>
          ))}
        </ul>
        <table className="data-table data-table-fixed hidden md:table">
          {/* A three-letter code and a short currency name; actions follow the name. */}
          <colgroup>
            <col className="w-28" />
            <col className="w-[32%]" />
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
            {rows.map((currency) => (
              <tr key={currency.id}>
                <td>
                  <span dir="ltr" className="code-chip">
                    {currency.currencyCode}
                  </span>
                </td>
                <th scope="row" className="font-semibold break-words">
                  {currency.name}
                </th>
                <td className="whitespace-nowrap">
                  <RowActions
                    align="start"
                    name={currency.name}
                    onEdit={() => dialog.open({ type: 'edit', currency })}
                    onDelete={() => dialog.open({ type: 'delete', currency })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      {(dialog.value?.type === 'create' || dialog.value?.type === 'edit') && (
        <CurrencyFormDialog
          currency={dialog.value.type === 'edit' ? dialog.value.currency : undefined}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
      {dialog.value?.type === 'delete' && (
        <DeleteCurrencyDialog
          currency={dialog.value.currency}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
    </Page>
  );
}
