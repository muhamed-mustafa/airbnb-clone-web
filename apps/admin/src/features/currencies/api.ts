'use client';

import type {
  CreateCurrencyDto,
  CurrencyResponseDto,
  Envelope,
  Paginated,
  UpdateCurrencyDto,
} from '@stays/api-contract';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PAGE_SIZE, toQuery } from '@/features/countries/api';
import { bffFetch } from '@/lib/bff-client';

export type Currency = CurrencyResponseDto;

export interface CurrencyListParams {
  page: number;
  name: string;
  currencyCode: string;
}

export const currencyKeys = {
  all: ['currencies'] as const,
  list: (params: CurrencyListParams) => ['currencies', 'list', params] as const,
};

export function useCurrencies(params: CurrencyListParams) {
  return useQuery({
    queryKey: currencyKeys.list(params),
    queryFn: ({ signal }) =>
      bffFetch<Paginated<Currency>>(
        `/bff/api/currencies?${toQuery({ ...params, limit: PAGE_SIZE })}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}

// Settled, not success: after a timeout or 404 the list must show the real state.
export function useCreateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCurrencyDto) =>
      bffFetch<Envelope<Currency>>('/bff/api/currencies', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: currencyKeys.all }),
  });
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCurrencyDto }) =>
      bffFetch<Envelope<Currency>>(`/bff/api/currencies/${id}`, { method: 'PATCH', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: currencyKeys.all }),
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffFetch<void>(`/bff/api/currencies/${id}`, { method: 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: currencyKeys.all }),
  });
}
