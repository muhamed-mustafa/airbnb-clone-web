import type { ReactNode } from 'react';

/**
 * Page body inside the workspace, centred, with a maximum width chosen by the kind of page:
 * - `dashboard` (about 76rem): several cards side by side;
 * - `table` (about 68rem): lists; their columns keep data and actions together;
 * - `form` (about 40rem): forms and label/value pages, which read best compact.
 */
export type PageWidth = 'dashboard' | 'table' | 'form';

export function Page({ width, children }: { width: PageWidth; children: ReactNode }) {
  return (
    <div className="page-body" data-width={width}>
      {children}
    </div>
  );
}
