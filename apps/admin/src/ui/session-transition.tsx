'use client';

import { createPortal } from 'react-dom';
import { BrandMark } from './brand';
import { SpinnerIcon } from './icons';

/** Outside the rail/drawer: no inherited dark theme or transformed containing block. */
export function SessionTransition({ label }: { label: string }) {
  return createPortal(
    <div
      role="status"
      className="auth-transition fixed inset-0 z-[100] grid place-items-center text-ink"
    >
      <div className="grid justify-items-center gap-4">
        <BrandMark />
        <SpinnerIcon width={24} height={24} />
        <p className="font-semibold">{label}</p>
      </div>
    </div>,
    document.body,
  );
}
