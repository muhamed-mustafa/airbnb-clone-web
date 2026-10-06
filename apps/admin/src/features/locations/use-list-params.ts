'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * List filters and page live in the URL so a view can be shared, bookmarked and restored
 * with Back. Only the declared keys are kept: the backend rejects unknown parameters.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = useMemo(
    () =>
      Object.fromEntries(keys.map((key) => [key, searchParams.get(key) ?? ''])) as Record<
        K,
        string
      >,
    [keys, searchParams],
  );
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const update = useCallback(
    (patch: Partial<Record<K, string>> & { page?: number }) => {
      const next = new URLSearchParams();
      for (const key of keys) {
        const value = key in patch ? patch[key] : values[key];
        if (value) next.set(key, value);
      }
      // Changing a filter returns to the first page; paging keeps the filters.
      const nextPage = patch.page ?? (Object.keys(patch).length > 0 ? 1 : page);
      if (nextPage > 1) next.set('page', String(nextPage));
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [keys, page, pathname, router, values],
  );

  const hasFilters = keys.some((key) => values[key] !== '');
  return { values, page, update, hasFilters };
}
