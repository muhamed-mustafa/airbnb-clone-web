'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffFetch } from '@/lib/bff-client';
import type { SessionStatus } from './session-status';

export const sessionKey = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => bffFetch<SessionStatus>('/bff/session', { signal }),
    staleTime: 5 * 60_000,
  });
}

/** Signs out of this browser only (the backend has no logout endpoint yet). */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bffFetch<void>('/bff/session', { method: 'DELETE' }),
    onSettled: () => {
      queryClient.clear();
      // Full page load on purpose: nothing from the ended session may survive in memory.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login?reason=signed-out');
    },
  });
}
