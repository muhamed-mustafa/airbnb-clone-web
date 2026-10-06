'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/use-session';
import { FilterInput } from '@/features/locations/filter-input';
import { ListFrame } from '@/features/locations/list-frame';
import { useListParams } from '@/features/locations/use-list-params';
import { Button } from '@/ui/button';
import { SelectField } from '@/ui/field';
import { EmptyState } from '@/ui/states';
import { useAdmins, type Admin } from './api';
import { isSendableEmail, isSendableName, normalizeEmailFilter } from './admin-filters';

const FILTER_KEYS = ['name', 'email', 'isSuperAdmin'] as const;

function RoleBadge({ admin }: { admin: Admin }) {
  const t = useTranslations('admins');
  return admin.isSuperAdmin ? (
    <span className="justify-self-start rounded-full bg-accent-tint px-2 py-0.5 text-xs font-semibold text-accent">
      {t('superAdmin')}
    </span>
  ) : (
    <span className="text-xs text-muted">{t('admin')}</span>
  );
}

function YouMark({ admin, currentId }: { admin: Admin; currentId?: string }) {
  const t = useTranslations('admins');
  return admin.id === currentId ? <span className="text-xs text-muted"> ({t('you')})</span> : null;
}

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
      className="inline-flex min-h-10 items-center rounded-md px-2.5 text-sm font-semibold text-accent hover:bg-sunken pointer-coarse:min-h-11"
      aria-label={`${t('view')} ${admin.name}`}
    >
      {t('view')}
    </Link>
  );

  return (
    <div className="grid gap-5">
      <div className="grid gap-0.5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="tabular text-sm text-muted" aria-live="polite">
          {meta ? t('count', { count: meta.total }) : ' '}
        </p>
      </div>

      <p className="max-w-3xl rounded-md border border-hairline bg-sunken px-3 py-2.5 text-sm text-ink">
        {t('readOnlyNote')}
      </p>

      <search className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,18rem)_minmax(0,11rem)_auto]">
        <FilterInput
          resetToken={resetToken}
          label={t('searchName')}
          hint={t('searchNameHint')}
          value={values.name}
          isSendable={isSendableName}
          onCommit={(name) => update({ name })}
          maxLength={50}
        />
        <FilterInput
          resetToken={resetToken}
          label={t('searchEmail')}
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
        {hasFilters && (
          <Button variant="ghost" className="justify-self-start sm:mt-7" onClick={clear}>
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
        empty={<EmptyState title={t('noResultsTitle')} body={t('noResultsBody')} />}
      >
        <ul className="divide-y divide-hairline md:hidden">
          {rows.map((admin) => (
            <li
              key={admin.id}
              className="flex min-h-16 items-center justify-between gap-3 px-4 py-2"
            >
              <div className="grid min-w-0 gap-0.5">
                <span className="break-words">
                  {admin.name}
                  <YouMark admin={admin} currentId={currentId} />
                </span>
                <span className="break-all text-xs text-muted">
                  <bdi dir="ltr">{admin.email}</bdi>
                </span>
                <RoleBadge admin={admin} />
              </div>
              {detailLink(admin)}
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
                {t('columnEmail')}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                {t('columnRole')}
              </th>
              <th scope="col" className="w-28 px-4 py-2.5 text-end font-semibold">
                <span className="sr-only">{tc('actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((admin) => (
              <tr key={admin.id} className="h-14 hover:bg-ground">
                <th scope="row" className="px-4 text-start font-normal">
                  {admin.name}
                  <YouMark admin={admin} currentId={currentId} />
                </th>
                <td className="px-4 text-muted">
                  <bdi dir="ltr">{admin.email}</bdi>
                </td>
                <td className="px-4">
                  <RoleBadge admin={admin} />
                </td>
                <td className="px-4 text-end">{detailLink(admin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListFrame>
    </div>
  );
}
