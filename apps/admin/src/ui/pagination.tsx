'use client';

import type { PaginationMeta } from '@stays/api-contract';
import { useTranslations } from 'next-intl';
import { Button } from './button';
import { ChevronNextIcon } from './icons';

export function Pagination({
  meta,
  onPage,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
}) {
  const t = useTranslations('pagination');
  if (meta.totalPages <= 1) return null;
  return (
    <nav
      aria-label={t('label')}
      className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3 sm:px-5"
    >
      <Button
        size="sm"
        disabled={!meta.hasPreviousPage}
        onClick={() => onPage(meta.page - 1)}
        icon={<ChevronNextIcon className="-scale-x-100 rtl:scale-x-100" width={18} height={18} />}
      >
        {t('previous')}
      </Button>
      <p className="tabular text-sm text-muted" aria-live="polite">
        {t('status', { page: meta.page, totalPages: meta.totalPages })}
      </p>
      <Button size="sm" disabled={!meta.hasNextPage} onClick={() => onPage(meta.page + 1)}>
        {t('next')}
        <ChevronNextIcon className="rtl:-scale-x-100" width={18} height={18} />
      </Button>
    </nav>
  );
}
