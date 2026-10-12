import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronNextIcon } from './icons';

/** Read-only label/value rows in a panel (profile, admin details). */
export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="ui-panel divide-y divide-hairline">{children}</dl>;
}

export function DetailRow({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-1 px-4 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
      {action && <dd className="-ms-2 sm:ms-0">{action}</dd>}
    </div>
  );
}

/** "Back to …": the arrow points back in the reading direction (mirrored in RTL). */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="ui-button btn-ghost size-sm -ms-2.5 justify-self-start text-accent"
    >
      <ChevronNextIcon width={16} height={16} className="-scale-x-100 rtl:scale-x-100" />
      {children}
    </Link>
  );
}
