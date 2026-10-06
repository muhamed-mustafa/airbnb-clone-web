'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { isBffError, setSessionExpiredHandler } from '@/lib/bff-client';
import { ToastProvider } from '@/ui/toast';

// Not session_refresh_unavailable or rate_limited: those carry Retry-After; the user retries.
const RETRYABLE = new Set(['network', 'timeout', 'server']);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Reads are idempotent: retry transient failures once. Never auth or validation errors.
        retry: (failureCount, error) =>
          failureCount < 1 && isBffError(error) && RETRYABLE.has(error.appError.kind),
      },
      // Writes are never retried automatically: a timed-out write may have been applied.
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = createQueryClient();
    let redirecting = false;
    setSessionExpiredHandler(() => {
      if (redirecting) return;
      redirecting = true;
      // Private data must not outlive the session.
      client.clear();
      const next = `${window.location.pathname}${window.location.search}`;
      // Full page load on purpose: nothing from the ended session may survive in memory.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?reason=expired&next=${encodeURIComponent(next)}`);
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
