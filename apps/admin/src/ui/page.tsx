import type { ReactNode } from 'react';

/**
 * Page body inside the workspace:
 * - `wide` (default): the full workspace width, for dashboards and lists. Lists keep data
 *   and actions together through their own column proportions, not a narrower page;
 * - `details` (about 40rem): label/value pages and short forms, which read best compact.
 */
export type PageWidth = 'details' | 'wide';

export function Page({ width = 'wide', children }: { width?: PageWidth; children: ReactNode }) {
  return (
    <div className="page-body" data-width={width}>
      {children}
    </div>
  );
}
