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
import { useUnitCategories, type UnitCategory } from './api';

// Forms (react-hook-form + zod) load when a dialog opens, not with the list.
const UnitCategoryFormDialog = dynamic(() =>
  import('./category-form-dialog').then((module) => module.UnitCategoryFormDialog),
);
const DeleteUnitCategoryDialog = dynamic(() =>
  import('./delete-category-dialog').then((module) => module.DeleteUnitCategoryDialog),
);

// URL keys match the backend's query parameters (unknown ones are rejected upstream).
const FILTER_KEYS = ['name'] as const;

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; category: UnitCategory }
  | { type: 'delete'; category: UnitCategory };

export function UnitCategoriesScreen() {
  const t = useTranslations('unitCategories');
  const tc = useTranslations('common');
  const { values, page, update, clear, hasFilters, resetToken } = useListParams(FILTER_KEYS);
  const dialog = useDialog<DialogState>();

  const query = useUnitCategories({ page, name: values.name });
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
      <search className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,20rem)]">
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
        filters={values.name ? [{ key: 'name', label: t('columnName'), value: values.name }] : []}
        onRemove={() => update({ name: '' })}
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
        <ul className="md:hidden">
          {rows.map((category) => (
            <ListRow
              key={category.id}
              actions={
                <RowActions
                  name={category.name}
                  onEdit={() => dialog.open({ type: 'edit', category })}
                  onDelete={() => dialog.open({ type: 'delete', category })}
                />
              }
            >
              <span className="font-semibold">{category.name}</span>
              {category.icon && (
                <span dir="ltr" className="font-mono text-xs text-muted">
                  {category.icon}
                </span>
              )}
            </ListRow>
          ))}
        </ul>
        <table className="data-table data-table-fixed hidden md:table">
          {/* Short type names and a short, optional icon key; actions follow the key. */}
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-44" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t('columnName')}</th>
              <th scope="col">{t('columnCode')}</th>
              <th scope="col">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((category) => (
              <tr key={category.id}>
                <th scope="row" className="font-semibold break-words">
                  {category.name}
                </th>
                <td className="font-mono text-muted [overflow-wrap:anywhere]">
                  <span dir="ltr">{category.icon || '—'}</span>
                </td>
                <td className="whitespace-nowrap">
                  <RowActions
                    align="start"
                    name={category.name}
                    onEdit={() => dialog.open({ type: 'edit', category })}
                    onDelete={() => dialog.open({ type: 'delete', category })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>

      {(dialog.value?.type === 'create' || dialog.value?.type === 'edit') && (
        <UnitCategoryFormDialog
          category={dialog.value.type === 'edit' ? dialog.value.category : undefined}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
      {dialog.value?.type === 'delete' && (
        <DeleteUnitCategoryDialog
          category={dialog.value.category}
          onClose={dialog.close}
          returnFocusTo={dialog.opener}
        />
      )}
    </Page>
  );
}
