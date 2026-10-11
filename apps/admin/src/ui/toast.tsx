'use client';

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckIcon } from './icons';

interface Toast {
  id: number;
  message: string;
}

const ToastContext = createContext<((message: string) => void) | null>(null);

/**
 * Confirmation after a successful action. Announced politely; errors are never toasts,
 * they stay next to what failed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: string) => {
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-2), { id, message }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] grid justify-items-center gap-2 sm:inset-x-auto sm:end-6 sm:justify-items-end"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className="toast-enter flex items-center gap-2 rounded-md bg-ink px-4 py-3 text-sm text-white shadow-lg"
          >
            <CheckIcon width={18} height={18} />
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const notify = use(ToastContext);
  if (!notify) throw new Error('useToast must be used inside ToastProvider');
  return notify;
}
