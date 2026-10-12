'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/use-session';
import { AppliedFilters } from '@/features/locations/applied-filters';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { useListParams } from '@/features/locations/use-list-params';
import { EmailText } from '@/ui/email-text';
import { SelectField } from '@/ui/field';
import { ChevronNextIcon } from '@/ui/icons';
import { ListRow } from '@/ui/list-row';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
import { EmptyState } from '@/ui/states';
import { useAdmins, type Admin } from './api';
import { RoleBadge } from './role-badge';
import { isSendableEmail, isSendableName, normalizeEmailFilter } from './admin-filters';

const FILTER_KEYS = ['name', 'email', 'isSuperAdmin'] as const;

function YouMark({ admin, currentId }: { admin: Admin; currentId?: string }) {
  const t = useTranslations('admins');
  return admin.id === currentId ? (
    <span className="text-xs font-normal text-muted"> ({t('you')})</span>
  ) : null;
}

/** Read-only: the API has no create, update or deactivate for admin accounts. */
export function AdminsScreen() {
  const t = useTranslations('admins');
  const tc = useTranslations('common');
  const { values, page, update, clear, hasFilters, resetToken } = useListParams(FILTER_KEYS);
  const currentId = useSession().data?.subject?.id;

  const query = useAdmins({
    page,
    name: values.name,
    email: values.email,
    isSuperAdmin:
      values.isSuperAdmin === 'true' || values.isSuperAdmin === 'false' ? values.isSuperAdmin : '',
  });
  const meta = query.data?.meta;
  const rows = query.data?.data ?? [];

  const detailLink = (admin: Admin) => (
    <Link
      href={`/team/admins/${admin.id}`}
      className="ui-button btn-ghost size-sm text-accent"
      aria-label={`${t('view')} ${admin.name}`}
    >
      {t('view')}
      <ChevronNextIcon width={16} height={16} className="rtl:-scale-x-100" />
    </Link>
  );

  const roleLabel = (value: string) => (value === 'true' ? t('superAdmin') : t('admin'));

  const toolbar = (
    <div className="list-toolbar grid gap-3">
      <search className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,18rem)_minmax(0,11rem)]">
        <FilterInput
          resetToken={resetToken}
          label={t('searchName')}
          placeholder={t('searchNamePlaceholder')}
          hint={t('searchNameHint')}
          value={values.name}
          isSendable={isSendableName}
          onCommit={(name) => update({ name })}
          maxLength={50}
        />
        <FilterInput
          resetToken={resetToken}
          label={t('searchEmail')}
          placeholder={t('emailPlaceholder')}
          hint={t('searchEmailHint')}
          value={values.email}
          normalize={normalizeEmailFilter}
          isSendable={isSendableEmail}
          onCommit={(email) => update({ email })}
          inputMode="email"
          dir="ltr"
        />
        <SelectField
          label={t('filterRole')}
          value={values.isSuperAdmin}
          onChange={(event) => update({ isSuperAdmin: event.target.value })}
        >
          <option value="">{t('allRoles')}</option>
          <option value="true">{t('superAdmin')}</option>
          <option value="false">{t('admin')}</option>
        </SelectField>
      </search>
      <AppliedFilters
        filters={FILTER_KEYS.filter((key) => values[key]).map((key) => ({
          key,
          label:
            key === 'name' ? t('columnName') : key === 'email' ? t('columnEmail') : t('columnRole'),
          value: key === 'isSuperAdmin' ? roleLabel(values[key]) : values[key],
        }))}
        onRemove={(key) => update({ [key]: '' })}
        onClear={clear}
      />
    </div>
  );

  return (
    <Page>
      <PageHeader title={t('title')} summary={meta ? t('count', { count: meta.total }) : ' '} />

      <p className="info-note">{t('readOnlyNote')}</p>

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
            <EmptyState title={t('noResultsTitle')} body={t('noResultsBody')} />
          )
        }
      >
        <ul className="md:hidden">
          {rows.map((admin) => (
            <ListRow key={admin.id} actions={detailLink(admin)}>
              <span className="font-semibold">
                {admin.name}
                <YouMark admin={admin} currentId={currentId} />
              </span>
              <span className="text-xs text-muted">
                <EmailText email={admin.email} />
              </span>
              <span>
                <RoleBadge admin={admin} />
              </span>
            </ListRow>
          ))}
        </ul>
        <table className="data-table hidden md:table">
          <thead>
            <tr>
              <th scope="col" className="w-[30%]">
                {t('columnName')}
              </th>
              <th scope="col">{t('columnEmail')}</th>
              <th scope="col" className="w-40">
                {t('columnRole')}
              </th>
              <th scope="col" className="w-px">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((admin) => (
              <tr key={admin.id}>
                <th scope="row" className="font-semibold break-words">
                  {admin.name}
                  <YouMark admin={admin} currentId={currentId} />
                </th>
                <td className="text-muted">
                  <EmailText email={admin.email} />
                </td>
                <td>
                  <RoleBadge admin={admin} />
                </td>
                <td className="whitespace-nowrap">{detailLink(admin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </Page>
  );
}
