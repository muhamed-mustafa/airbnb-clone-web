'use client';

import type {
  CountryResponseDto,
  CreateCountryDto,
  Envelope,
  Paginated,
  UpdateCountryDto,
} from '@stays/api-contract';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffFetch } from '@/lib/bff-client';

export type Country = CountryResponseDto;

export const PAGE_SIZE = 20;

export interface CountryListParams {
  page: number;
  name: string;
  code: string;
}

export const countryKeys = {
  all: ['countries'] as const,
  list: (params: CountryListParams) => ['countries', 'list', params] as const,
  options: ['countries', 'options'] as const,
};

const toQuery = (entries: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(entries)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();

export function useCountries(params: CountryListParams) {
  return useQuery({
    queryKey: countryKeys.list(params),
    queryFn: ({ signal }) =>
      bffFetch<Paginated<Country>>(
        `/bff/api/countries?${toQuery({ ...params, limit: PAGE_SIZE })}`,
        {
          signal,
        },
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * Every country, for selects and for showing a city's country name (the backend returns
 * only the country id, report L4). Pages through the maximum page size of 100.
 */
export function useCountryOptions() {
  return useQuery({
    queryKey: countryKeys.options,
    queryFn: async ({ signal }) => {
      const countries: Country[] = [];
      for (let page = 1; ; page += 1) {
        const result = await bffFetch<Paginated<Country>>(
          `/bff/api/countries?page=${page}&limit=100`,
          {
            signal,
          },
        );
        countries.push(...result.data);
        if (!result.meta.hasNextPage || page >= 20) return countries;
      }
    },
  });
}

export function useCreateCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCountryDto) =>
      bffFetch<Envelope<Country>>('/bff/api/countries', { method: 'POST', body }),
    // Settled, not success: after a timeout or 404 the list must show the real state.
    onSettled: () => queryClient.invalidateQueries({ queryKey: countryKeys.all }),
  });
}

export function useUpdateCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCountryDto }) =>
      bffFetch<Envelope<Country>>(`/bff/api/countries/${id}`, { method: 'PATCH', body }),
    // Settled, not success: after a timeout or 404 the list must show the real state.
    onSettled: () => queryClient.invalidateQueries({ queryKey: countryKeys.all }),
  });
}

export function useDeleteCountry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffFetch<void>(`/bff/api/countries/${id}`, { method: 'DELETE' }),
    // Deleting a country also deletes its cities in the backend (report L8).
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: countryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['cities'] }),
      ]),
  });
}

export { toQuery };
