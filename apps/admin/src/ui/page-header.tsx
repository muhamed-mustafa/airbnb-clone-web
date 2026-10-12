import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  /** One short line under the title: a live count, or what the page is for. */
  summary?: ReactNode;
  /** The page's primary action (at most one primary button), aligned to the end. */
  action?: ReactNode;
}

/** Title, summary and the page action, the same on every screen. */
export function PageHeader({ title, summary, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="grid min-w-0 gap-1">
        <h1 className="page-title">{title}</h1>
        {summary !== undefined && (
          <p className="tabular min-h-5 text-sm text-muted" aria-live="polite">
            {summary}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
