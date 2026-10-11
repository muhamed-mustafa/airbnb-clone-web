'use client';

import type {
  CreateUnitCategoryDto,
  UnitCategoryResponseDto,
  Envelope,
  Paginated,
  UpdateUnitCategoryDto,
} from '@stays/api-contract';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PAGE_SIZE, toQuery } from '@/features/countries/api';
import { bffFetch } from '@/lib/bff-client';

export type UnitCategory = UnitCategoryResponseDto;

export interface UnitCategoryListParams {
  page: number;
  name: string;
}

export const categoryKeys = {
  all: ['unit-categories'] as const,
  list: (params: UnitCategoryListParams) => ['unit-categories', 'list', params] as const,
};

export function useUnitCategories(params: UnitCategoryListParams) {
  return useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: ({ signal }) =>
      bffFetch<Paginated<UnitCategory>>(
        `/bff/api/unit-categories?${toQuery({ ...params, limit: PAGE_SIZE })}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}

// Settled, not success: after a timeout or 404 the list must show the real state.
export function useCreateUnitCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUnitCategoryDto) =>
      bffFetch<Envelope<UnitCategory>>('/bff/api/unit-categories', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useUpdateUnitCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUnitCategoryDto }) =>
      bffFetch<Envelope<UnitCategory>>(`/bff/api/unit-categories/${id}`, { method: 'PATCH', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useDeleteUnitCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      bffFetch<void>(`/bff/api/unit-categories/${id}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
