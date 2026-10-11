'use client';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
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
    <div
      role="status"
      className="auth-transition fixed inset-0 z-[100] grid place-items-center text-ink"
    >
      <div
        className="session-story grid justify-items-center gap-6"
        data-action={action}
        data-complete={complete}
      >
        <div aria-hidden="true" className="session-emblem">
          <span className="session-halo" />
          <svg viewBox="0 0 120 120" className="session-seal" fill="none">
            <circle className="session-orbit" cx="60" cy="60" r="53" />
            <path className="session-mark" d="M36 76V49l24-17 24 17v27H36Z M51 76V59h18v17" />
            {complete && action === 'enter' && (
              <path className="session-confirm" d="m44 61 11 11 23-25" />
            )}
            {complete && action === 'exit' && (
              <g className="session-lock">
                <path d="M49 57v-9a11 11 0 0 1 22 0v9" />
                <rect x="43" y="57" width="34" height="29" rx="5" />
                <path d="M60 67v9" />
              </g>
            )}
          </svg>
        </div>
        <div className="session-copy grid gap-2 text-center">
          <p className="text-xl font-semibold">
            {complete ? t(action === 'enter' ? 'entered' : 'exited') : label}
          </p>
          <p className="text-sm text-muted">
            {t(complete ? (action === 'enter' ? 'ready' : 'closed') : 'working')}
          </p>
        </div>
        <span className="scene-progress" aria-hidden="true" />
      </div>
    </div>,
    document.body,
  );
}
export async function finishSessionScene() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
}
