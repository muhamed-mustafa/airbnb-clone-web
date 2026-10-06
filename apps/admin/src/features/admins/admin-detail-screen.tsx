'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/use-session';
import { isBffError } from '@/lib/bff-client';
import { ChevronNextIcon } from '@/ui/icons';
import { EmptyState, ErrorPanel, RowsSkeleton } from '@/ui/states';
import { useAdmin } from './api';

export function AdminDetailScreen({ id }: { id: string }) {
  const t = useTranslations('admins');
  const tc = useTranslations('common');
  const admin = useAdmin(id);
  const currentId = useSession().data?.subject?.id;

  const back = (
    <Link
      href="/team/admins"
      className="inline-flex min-h-10 items-center gap-1 justify-self-start rounded-md px-2 text-sm font-semibold text-accent hover:bg-sunken pointer-coarse:min-h-11"
    >
      <ChevronNextIcon width={18} height={18} className="-scale-x-100 rtl:scale-x-100" />
      {t('backToList')}
    </Link>
  );

  if (admin.isPending) {
    return (
      <div className="grid gap-4">
        {back}
        <RowsSkeleton rows={3} label={tc('loading')} />
      </div>
    );
  }

  if (admin.isError) {
    const appError = isBffError(admin.error)
      ? admin.error.appError
      : { kind: 'unknown' as const, formErrors: [], fieldErrors: {} };
    return (
      <div className="grid gap-4">
        {back}
        {appError.kind === 'not_found' ? (
          <EmptyState title={t('notFoundTitle')} body={t('notFoundBody')} />
        ) : (
          <ErrorPanel error={appError} onRetry={() => void admin.refetch()} />
        )}
      </div>
    );
  }

  const data = admin.data;
  return (
    <div className="grid max-w-2xl gap-5">
      {back}
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">
          {data.name}
          {data.id === currentId && (
            <span className="text-base font-normal text-muted"> ({t('you')})</span>
          )}
        </h1>
        <p className="text-sm text-muted">{t('detailIntro')}</p>
      </div>
      <dl className="grid gap-0 divide-y divide-hairline rounded-lg border border-hairline bg-surface">
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">{t('columnEmail')}</dt>
          <dd className="break-all">
            <bdi dir="ltr">{data.email}</bdi>
          </dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">{t('columnRole')}</dt>
          <dd>{data.isSuperAdmin ? t('superAdmin') : t('admin')}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">{t('accountId')}</dt>
          <dd className="break-all font-mono text-sm">
            <bdi dir="ltr">{data.id}</bdi>
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted">{t('superAdminNote')}</p>
    </div>
  );
}
