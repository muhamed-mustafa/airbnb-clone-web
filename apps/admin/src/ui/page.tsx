import type { ReactNode } from 'react';

/**
 * Page body with an intentional content width, chosen per layout so data and its actions
 * stay close on wide screens:
 * - `details` (about 40rem): label/value pages and short forms;
 * - `list` (about 46rem): lists with a code or two short columns;
 * - `list-wide` (about 54rem): lists with two text columns and a filter select;
 * - `wide`: the full content width, for dashboards and lists with several columns.
 */
export type PageWidth = 'details' | 'list' | 'list-wide' | 'wide';

export function Page({ width = 'wide', children }: { width?: PageWidth; children: ReactNode }) {
  return (
    <div className="page-body" data-width={width}>
      {children}
    </div>
  );
}
