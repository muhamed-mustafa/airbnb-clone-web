import type { ReactNode } from 'react';

/**
 * A row of a list on phones: the record's information first, its actions after. When the
 * information needs the width (long names), the actions move to a second line, aligned to
 * the end, instead of squeezing the text.
 */
export function ListRow({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <li className="list-row">
      <div className="list-row-main">{children}</div>
      <div className="list-row-actions">{actions}</div>
    </li>
  );
}
