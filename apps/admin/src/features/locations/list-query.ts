export type ListPatch<K extends string> = Partial<Record<K, string>> & { page?: number };

/**
 * Next list query from a base query and a patch. Pure, so filters changed in quick
 * succession can be applied on top of each other without losing one.
 *  - only declared keys survive (the backend rejects unknown parameters);
 *  - changing any filter returns to page 1; a page-only patch keeps the filters.
 */
export function nextListQuery<K extends string>(
  keys: readonly K[],
  base: URLSearchParams,
  patch: ListPatch<K>,
): string {
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = key in patch ? patch[key] : (base.get(key) ?? '');
    if (value) next.set(key, value);
  }
  const changesFilters = keys.some((key) => key in patch);
  const basePage = Math.max(1, Number.parseInt(base.get('page') ?? '1', 10) || 1);
  const page = patch.page ?? (changesFilters ? 1 : basePage);
  if (page > 1) next.set('page', String(page));
  return next.toString();
}
