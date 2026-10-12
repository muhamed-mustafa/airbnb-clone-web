'use client';

import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/use-session';
import { isBffError } from '@/lib/bff-client';
import { CopyButton } from '@/ui/copy-button';
import { BackLink, DetailList, DetailRow } from '@/ui/detail-list';
import { EmailText } from '@/ui/email-text';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';
import { EmptyState, ErrorPanel, RowsSkeleton } from '@/ui/states';
import { useAdmin } from './api';
import { RoleBadge } from './role-badge';

/** Read-only: the contract offers no edit for admin accounts. */
export function AdminDetailScreen({ id }: { id: string }) {
  const t = useTranslations('admins');
  const ta = useTranslations('account');
  const tc = useTranslations('common');
  const admin = useAdmin(id);
  const currentId = useSession().data?.subject?.id;
  const back = <BackLink href="/team/admins">{t('backToList')}</BackLink>;

  if (admin.isPending) {
    return (
      <Page width="details">
        {back}
        <div className="ui-panel">
          <RowsSkeleton rows={3} label={tc('loading')} />
        </div>
      </Page>
    );
  }

  if (admin.isError) {
    const appError = isBffError(admin.error)
      ? admin.error.appError
      : { kind: 'unknown' as const, formErrors: [], fieldErrors: {} };
    return (
      <Page width="details">
        {back}
        <div className="ui-panel">
          {appError.kind === 'not_found' ? (
            <EmptyState title={t('notFoundTitle')} body={t('notFoundBody')} />
          ) : (
            <ErrorPanel error={appError} onRetry={() => void admin.refetch()} />
          )}
        </div>
      </Page>
    );
  }

  const data = admin.data;
  return (
    <Page width="details">
      {back}
      <PageHeader
        title={
          <>
            {data.name}
            {data.id === currentId && (
              <span className="text-base font-normal text-muted"> ({t('you')})</span>
            )}
          </>
        }
        summary={t('detailIntro')}
      />
      <DetailList>
        <DetailRow
          label={t('columnEmail')}
          action={<CopyButton value={data.email} label={ta('copyEmail')} />}
        >
          <EmailText email={data.email} />
        </DetailRow>
        <DetailRow label={t('columnRole')}>
          <RoleBadge admin={data} />
        </DetailRow>
        <DetailRow
          label={t('accountId')}
          action={<CopyButton value={data.id} label={ta('copyId')} />}
        >
          <bdi dir="ltr" className="font-mono text-sm [overflow-wrap:anywhere]">
            {data.id}
          </bdi>
        </DetailRow>
      </DetailList>
      <p className="text-sm text-muted">{t('superAdminNote')}</p>
    </Page>
  );
}
