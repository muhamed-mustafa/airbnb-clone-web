'use client';

import type { AdminResponseDto, Envelope, Paginated } from '@stays/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PAGE_SIZE, toQuery } from '@/features/countries/api';
import { bffFetch } from '@/lib/bff-client';

/** Only these fields reach the browser: the BFF projects the backend response (D11). */
export type Admin = AdminResponseDto;

export interface AdminListParams {
  page: number;
  name: string;
  email: string;
  isSuperAdmin: string;
}

export const adminKeys = {
  all: ['admins'] as const,
  list: (params: AdminListParams) => ['admins', 'list', params] as const,
  detail: (id: string) => ['admins', 'detail', id] as const,
};

/** Read-only: the API has no create, update or delete for admin accounts. */
export function useAdmins(params: AdminListParams) {
  return useQuery({
    queryKey: adminKeys.list(params),
    queryFn: ({ signal }) =>
      bffFetch<Paginated<Admin>>(`/bff/api/admins?${toQuery({ ...params, limit: PAGE_SIZE })}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAdmin(id: string) {
  return useQuery({
    queryKey: adminKeys.detail(id),
    queryFn: ({ signal }) =>
      bffFetch<Envelope<Admin>>(`/bff/api/admins/${id}`, { signal }).then((result) => result.data),
    retry: false,
  });
}
