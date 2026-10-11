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
        <svg aria-hidden="true" viewBox="0 0 320 240" className="door-scene">
          <ellipse cx="160" cy="218" rx="120" ry="10" fill="#dce5ef" />
          <path
            d="M170 211V42h94v169"
            fill="#14243b"
            stroke="#14243b"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <rect x="181" y="51" width="72" height="160" fill="#d4e4ff" />
          <g className="scene-door">
            <path d="M181 51h72v160h-72z" fill="#2860d7" />
            <path d="M191 65h52v130h-52z" fill="none" stroke="#ffffff35" strokeWidth="2" />
            <circle cx="240" cy="133" r="4" fill="#edc78c" />
          </g>
          <g className="scene-person">
            <circle cx="106" cy="101" r="16" fill="#d6a16c" />
            <path d="M89 96q0-26 28-12l6 14-18-5-16 7" fill="#14243b" />
            <path d="M92 124q14-8 28 0l8 49H85z" fill="#14243b" />
            <path
              d="M96 172l-8 39M117 172l13 39"
              stroke="#14243b"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <path
              d="M94 133l-15 26M119 133l22 13"
              stroke="#d6a16c"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </g>
          <path d="M45 211h240" stroke="#93a4ba" strokeWidth="2" strokeLinecap="round" />
        </svg>
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
