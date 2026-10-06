'use client';

import { useCallback, useState } from 'react';

/**
 * Which dialog is open, plus the element that opened it. The opener is captured
 * synchronously in the event handler: by the time a lazily loaded dialog mounts, focus may
 * already have left the button, so the dialog cannot find it on its own.
 */
export function useDialog<T>() {
  const [state, setState] = useState<{ value: T; opener: HTMLElement | null } | null>(null);
  const open = useCallback(
    (value: T) => setState({ value, opener: document.activeElement as HTMLElement | null }),
    [],
  );
  const close = useCallback(() => setState(null), []);
  return { value: state?.value ?? null, opener: state?.opener ?? null, open, close };
}
