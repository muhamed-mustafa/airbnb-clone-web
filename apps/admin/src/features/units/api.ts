'use client';

import type { Envelope, Paginated } from '@stays/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCountryOptions } from '@/features/countries/api';
import { bffFetch } from '@/lib/bff-client';

export interface AdminUnit {
  id: string;
  user: string;
  title: string;
  description: string;
  address: string;
  photos: string[];
  costPerDay: number;
  country: string;
  city: string;
  unitCategory: string;
  roomsCount: number;
  adultsCount: number;
  kidsCount: number;
  hasInternetService: boolean;
  hasKitchen: boolean;
  hasPrivateGarage: boolean;
  availability: boolean;
  isActive: boolean;
  version: number;
}

export interface UnitListParams {
  page: number;
  title: string;
  isActive: string;
  availability: string;
  minPrice: string;
  maxPrice: string;
  country: string;
  city: string;
  unitCategory: string;
}

export const unitKeys = {
  all: ['admin-units'] as const,
  list: (params: UnitListParams) => ['admin-units', 'list', params] as const,
  detail: (id: string) => ['admin-units', 'detail', id] as const,
};

const queryString = (entries: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(entries)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();

export function useAdminUnits(params: UnitListParams) {
  return useQuery({
    queryKey: unitKeys.list(params),
    queryFn: ({ signal }) =>
      bffFetch<Paginated<AdminUnit>>(
        `/bff/api/units/admin?${queryString({ ...params, limit: 20 })}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUnit(id: string | undefined) {
  return useQuery({
    queryKey: unitKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async ({ signal }) =>
      (await bffFetch<Envelope<AdminUnit>>(`/bff/api/units/admin/${id}`, { signal })).data,
  });
}

export function useUnitReferenceNames(unit: AdminUnit | undefined) {
  return useQuery({
    queryKey: ['admin-unit-reference-names', unit?.country, unit?.city, unit?.unitCategory],
    enabled: Boolean(unit),
    queryFn: async ({ signal }) => {
      const [country, city, category] = await Promise.all([
        bffFetch<Envelope<{ name: string }>>(`/bff/api/countries/${unit!.country}`, { signal }),
        bffFetch<Envelope<{ name: string }>>(`/bff/api/cities/${unit!.city}`, { signal }),
        bffFetch<Envelope<{ name: string }>>(`/bff/api/unit-categories/${unit!.unitCategory}`, {
          signal,
        }),
      ]);
      return { country: country.data.name, city: city.data.name, category: category.data.name };
    },
    retry: false,
  });
}

interface UnitFilterOption {
  id: string;
  name: string;
}

export function useAdminUnitFilterOptions(countryId: string) {
  const countries = useCountryOptions();
  const categories = useQuery({
    queryKey: ['admin-unit-category-options'],
    queryFn: async ({ signal }) => {
      const options: UnitFilterOption[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const result = await bffFetch<Paginated<UnitFilterOption>>(
          `/bff/api/unit-categories?page=${page}&limit=100`,
          { signal },
        );
        options.push(...result.data);
        if (!result.meta.hasNextPage) break;
      }
      return options;
    },
  });
  const cities = useQuery({
    queryKey: ['admin-unit-city-options', countryId],
    enabled: Boolean(countryId),
    queryFn: async ({ signal }) => {
      const options: UnitFilterOption[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const query = new URLSearchParams({ page: String(page), limit: '100', country: countryId });
        const result = await bffFetch<Paginated<UnitFilterOption>>(`/bff/api/cities?${query}`, {
          signal,
        });
        options.push(...result.data);
        if (!result.meta.hasNextPage) break;
      }
      return options;
    },
  });
  return {
    countries: countries.data ?? [],
    categories: categories.data ?? [],
    cities: cities.data ?? [],
    citiesLoading: cities.isPending,
  };
}
