'use client';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { CheckIcon } from './icons';

/**
 * Sign-in / sign-out feedback while the request runs: a spinner, then a confirmation once
 * the request has succeeded (never before). It adds no waiting of its own.
 */
export function SessionTransition({
  label,
  action = 'exit',
  complete = false,
}: {
  label: string;
  action?: 'enter' | 'exit';
  complete?: boolean;
}) {
  const t = useTranslations('sessionMotion');
  return createPortal(
    <div role="status" className="session-overlay fixed inset-0 z-[100] grid place-items-center">
      <div className="session-story" data-action={action} data-complete={complete}>
        <span className="session-mark" aria-hidden="true">
          {complete ? (
            action === 'enter' ? (
              <CheckIcon width={22} height={22} />
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            )
          ) : (
            <span className="session-spinner" />
          )}
        </span>
        <div className="grid gap-0.5">
          <p className="font-semibold">
            {complete ? t(action === 'enter' ? 'entered' : 'exited') : label}
          </p>
          <p className="text-sm text-muted">
            {t(complete ? (action === 'enter' ? 'ready' : 'closed') : 'working')}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Lets the confirmed state paint before navigation starts (two frames, no fixed delay). */
export async function finishSessionScene() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
