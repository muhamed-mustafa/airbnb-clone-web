import { Fragment } from 'react';

/**
 * An email shown in full: left-to-right inside RTL text, wrapping after "@" and "." first
 * (natural break points) and anywhere only as a last resort. Never truncated.
 */
export function EmailText({ email, className = '' }: { email: string; className?: string }) {
  const parts = email.split(/(?<=[@.])/);
  return (
    <bdi dir="ltr" className={`[overflow-wrap:anywhere] ${className}`}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </bdi>
  );
}
