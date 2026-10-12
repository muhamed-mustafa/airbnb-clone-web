'use client';

import { useTranslations } from 'next-intl';
import { RoleBadge } from '@/features/admins/role-badge';
import { useAdmin } from '@/features/admins/api';
import { useSession } from '@/features/auth/use-session';
import { CopyButton } from '@/ui/copy-button';
import { DetailList, DetailRow } from '@/ui/detail-list';
import { EmailText } from '@/ui/email-text';
import { Page } from '@/ui/page';
import { PageHeader } from '@/ui/page-header';

/** The role comes from GET /admins/{id}, the only place the contract exposes it. */
function RoleValue({ id }: { id: string }) {
  const t = useTranslations('account');
  const admin = useAdmin(id);
  if (admin.isPending) return <span className="skeleton inline-block h-4 w-24 align-middle" />;
  if (admin.isError) return <span className="text-sm text-muted">{t('roleUnavailable')}</span>;
  return <RoleBadge admin={admin.data} />;
}

/** Read-only: the contract has no profile update, password change or avatar endpoints. */
export function AccountScreen() {
  const t = useTranslations('account');
  const session = useSession();
  const subject = session.data?.subject;

  return (
    <Page width="details">
      <PageHeader title={t('profile')} summary={t('profileSummary')} />
      {!subject ? (
        <div className="ui-panel grid gap-3 p-5" role="status" aria-label={t('profile')}>
          <span className="skeleton h-4 w-48" />
          <span className="skeleton h-4 w-72 max-w-full" />
        </div>
      ) : (
        <DetailList>
          <DetailRow label={t('name')}>
            <span className="break-words">{subject.name ?? '—'}</span>
          </DetailRow>
          <DetailRow
            label={t('email')}
            action={
              subject.email ? (
                <CopyButton value={subject.email} label={t('copyEmail')} />
              ) : undefined
            }
          >
            {subject.email ? <EmailText email={subject.email} /> : '—'}
          </DetailRow>
          <DetailRow label={t('role')}>
            <RoleValue id={subject.id} />
          </DetailRow>
          <DetailRow
            label={t('accountId')}
            action={<CopyButton value={subject.id} label={t('copyId')} />}
          >
            <bdi dir="ltr" className="font-mono text-sm [overflow-wrap:anywhere]">
              {subject.id}
            </bdi>
          </DetailRow>
        </DetailList>
      )}
      <p className="text-sm text-muted">{t('readOnly')}</p>
    </Page>
  );
}
