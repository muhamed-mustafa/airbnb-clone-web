'use client';

import { useTranslations } from 'next-intl';
import type { Admin } from './api';

/** "Super admin" stands out by background and text, "Admin" stays outlined. */
export function RoleBadge({ admin }: { admin: Pick<Admin, 'isSuperAdmin'> }) {
  const t = useTranslations('admins');
  return (
    <span className="role-badge" data-super={admin.isSuperAdmin || undefined}>
      {admin.isSuperAdmin ? t('superAdmin') : t('admin')}
    </span>
  );
}
