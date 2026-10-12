'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/ui/button';
import { CloseIcon } from '@/ui/icons';

export interface AppliedFilter {
  key: string;
  /** What the filter is ("Name", "Country"). */
  label: string;
  /** What it is set to, as the user would read it. */
  value: string;
}

/** The filters currently applied, each removable, plus "Clear filters". */
export function AppliedFilters({
  filters,
  onRemove,
  onClear,
}: {
  filters: AppliedFilter[];
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('listInteraction');
  const tc = useTranslations('common');
  if (filters.length === 0) return null;
  return (
    <div
      role="group"
      className="flex flex-wrap items-center gap-2"
      aria-label={t('appliedFilters')}
    >
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className="filter-chip"
          aria-label={t('removeFilter', { value: filter.value })}
          onClick={() => onRemove(filter.key)}
        >
          <span>
            <span className="text-muted">{filter.label}:</span> <bdi>{filter.value}</bdi>
          </span>
          <CloseIcon width={13} height={13} />
        </button>
      ))}
      <Button variant="ghost" size="sm" className="text-accent" onClick={onClear}>
        {tc('clearFilters')}
      </Button>
    </div>
  );
}
