'use client';

import type {
  CityResponseDto,
  CreateCityDto,
  Envelope,
  Paginated,
  UpdateCityDto,
} from '@stays/api-contract';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PAGE_SIZE, toQuery } from '@/features/countries/api';
import { bffFetch } from '@/lib/bff-client';

export type City = CityResponseDto;

export interface CityListParams {
  page: number;
  name: string;
  country: string;
}

export const cityKeys = {
  all: ['cities'] as const,
  list: (params: CityListParams) => ['cities', 'list', params] as const,
};

export function useCities(params: CityListParams) {
  return useQuery({
    queryKey: cityKeys.list(params),
    queryFn: ({ signal }) =>
      bffFetch<Paginated<City>>(`/bff/api/cities?${toQuery({ ...params, limit: PAGE_SIZE })}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCityDto) =>
      bffFetch<Envelope<City>>('/bff/api/cities', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: cityKeys.all }),
  });
}

export function useUpdateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCityDto }) =>
      bffFetch<Envelope<City>>(`/bff/api/cities/${id}`, { method: 'PATCH', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: cityKeys.all }),
  });
}

export function useDeleteCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffFetch<void>(`/bff/api/cities/${id}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: cityKeys.all }),
  });
}
