'use client';

import type { PaginationMeta } from '@stays/api-contract';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { isBffError } from '@/lib/bff-client';
import { Pagination } from '@/ui/pagination';
import { ErrorPanel, RowsSkeleton } from '@/ui/states';

interface ListFrameProps {
  isPending: boolean;
  error: unknown;
  meta: PaginationMeta | undefined;
  isEmpty: boolean;
  loadingLabel: string;
  empty: ReactNode;
  onRetry: () => void;
  onPage: (page: number) => void;
  /** True while a new page or filter loads over the previous results. */
  isRefreshing: boolean;
  children: ReactNode;
  toolbar?: ReactNode;
}

/** The single place where a list chooses between loading, error, empty and data. */
export function ListFrame({
  isPending,
  error,
  meta,
  isEmpty,
  loadingLabel,
  empty,
  onRetry,
  onPage,
  isRefreshing,
  children,
  toolbar,
}: ListFrameProps) {
  const t = useTranslations('listInteraction');
  let content: ReactNode;
  if (isPending) content = <RowsSkeleton label={loadingLabel} />;
  else if (error && !meta) {
    content = isBffError(error) ? (
      <ErrorPanel error={error.appError} onRetry={onRetry} />
    ) : (
      <ErrorPanel error={{ kind: 'unknown', formErrors: [], fieldErrors: {} }} onRetry={onRetry} />
    );
  } else if (isEmpty) content = empty;
  else content = children;

  return (
    <section aria-busy={isPending || isRefreshing} className="ui-panel relative">
      {toolbar}
      {isRefreshing && (
        <div
          className="list-refresh flex items-center gap-2 px-5 py-1.5 text-xs font-semibold text-accent-strong"
          role="status"
        >
          <span className="refresh-dot" aria-hidden="true" />
          {t('updating')}
        </div>
      )}
      {content}
      {meta && !isEmpty && <Pagination meta={meta} onPage={onPage} />}
    </section>
  );
}
