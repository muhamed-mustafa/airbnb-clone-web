'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nextListQuery, type ListPatch } from './list-query';

/**
 * List filters and page live in the URL so a view can be shared, bookmarked and restored
 * with Back. Only the declared keys are kept: the backend rejects unknown parameters.
 *
 * `update` may run from a debounce timer, after newer renders: it reads the latest URL
 * (or the last one it requested, if the router has not applied it yet) through refs, and
 * does nothing once the list has unmounted, so a late search can neither drop another
 * filter nor navigate back to a page the user already left.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Changes on "Clear filters" so inputs drop their drafts and pending searches.
  const [resetToken, setResetToken] = useState(0);

  const latest = useRef({ searchParams, pathname });
  const requested = useRef<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    latest.current = { searchParams, pathname };
    // The router applied a change (ours or Back/Forward): it is the new base.
    requested.current = null;
  }, [searchParams, pathname]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
    (patch: ListPatch<K>) => {
      if (!mounted.current) return;
      const base = new URLSearchParams(requested.current ?? latest.current.searchParams.toString());
      const query = nextListQuery(keys, base, patch);
      requested.current = query;
      const path = latest.current.pathname;
      router.replace(query ? `${path}?${query}` : path, { scroll: false });
    },
    [keys, router],
  );

  const clear = useCallback(() => {
    setResetToken((token) => token + 1);
    update(Object.fromEntries(keys.map((key) => [key, ''])) as ListPatch<K>);
  }, [keys, update]);

  const hasFilters = keys.some((key) => values[key] !== '');
  return { values, page, update, clear, hasFilters, resetToken };
}
