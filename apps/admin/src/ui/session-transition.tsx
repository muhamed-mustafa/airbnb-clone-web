'use client';
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
        <div aria-hidden="true" className="door-scene">
          <div className="scene-architecture">
            <div className="scene-wall" />
            <div className="scene-floor" />
            <div className="scene-light" />
            <div className="scene-frame">
              <div className="scene-interior" />
              <div className="scene-door">
                <span className="scene-door-inlay" />
                <span className="scene-handle" />
              </div>
            </div>
            <div className="scene-threshold" />
          </div>
        </div>
        <p className="text-xl font-semibold">{label}</p>
        <span className="scene-progress" aria-hidden="true" />
      </div>
    </div>,
    document.body,
  );
}
export async function finishSessionScene() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
}
