'use client';

import type { Paginated } from '@stays/api-contract';
import { useQueries, useQuery } from '@tanstack/react-query';
import { bffFetch } from '@/lib/bff-client';

/**
 * Home data comes only from what the API returns exactly: list totals (meta.total with
 * limit=1) and, for small datasets, per-country city totals. Nothing is estimated.
 *
 * Request budget for one load of the home page: 5 resource totals + 2 role totals + 1
 * country list + at most CITY_BREAKDOWN_MAX_COUNTRIES (12) per-country totals + 1 pricing
 * settings = at most 21 requests, cached for a minute.
 *
 * These are separate requests, not one snapshot: a record added or deleted between them can
 * make, for example, the sum of the chart differ briefly from the cities total. The figures
 * converge on the next refetch. A consistent snapshot needs an aggregate backend endpoint.
 */

const STALE = 60_000;

/** Exact count of a list endpoint, optionally filtered. One request, one row. */
export function useTotal(resource: string, filter = '') {
  return useQuery({
    queryKey: ['home', 'total', resource, filter],
    queryFn: ({ signal }) =>
      bffFetch<Paginated<unknown>>(`/bff/api/${resource}?page=1&limit=1${filter}`, {
        signal,
      }).then((result) => result.meta.total),
    staleTime: STALE,
  });
}

/**
 * Above this many countries, a per-country breakdown would need one request per country.
 * That is reasonable for a handful, not in general: the chart then asks for an aggregate
 * endpoint instead of loading every country and city.
 */
export const CITY_BREAKDOWN_MAX_COUNTRIES = 12;

interface CountryRow {
  id: string;
  name: string;
  code: string;
}

export type CityBreakdown =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'too-many'; countries: number }
  | { status: 'ready'; rows: { name: string; code: string; cities: number }[] };

export function useCityBreakdown(): CityBreakdown & { retry: () => void } {
  const countries = useQuery({
    queryKey: ['home', 'countries-for-breakdown'],
    queryFn: ({ signal }) =>
      bffFetch<Paginated<CountryRow>>(
        `/bff/api/countries?page=1&limit=${CITY_BREAKDOWN_MAX_COUNTRIES}`,
        { signal },
      ),
    staleTime: STALE,
  });
  const complete =
    countries.data && countries.data.meta.total <= CITY_BREAKDOWN_MAX_COUNTRIES
      ? countries.data.data
      : [];
  const counts = useQueries({
    queries: complete.map((country) => ({
      queryKey: ['home', 'total', 'cities', `&country=${country.id}`],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        bffFetch<Paginated<unknown>>(`/bff/api/cities?page=1&limit=1&country=${country.id}`, {
          signal,
        }).then((result) => result.meta.total),
      staleTime: STALE,
    })),
  });
  const retry = () => {
    void countries.refetch();
    counts.forEach((query) => void query.refetch());
  };

  if (countries.isError || counts.some((query) => query.isError)) return { status: 'error', retry };
  if (countries.isPending || counts.some((query) => query.isPending)) {
    return { status: 'pending', retry };
  }
  if (countries.data.meta.total > CITY_BREAKDOWN_MAX_COUNTRIES) {
    return { status: 'too-many', countries: countries.data.meta.total, retry };
  }
  const rows = complete
    .map((country, index) => ({
      name: country.name,
      code: country.code,
      cities: counts[index]?.data ?? 0,
    }))
    .sort((a, b) => b.cities - a.cities || a.name.localeCompare(b.name));
  return { status: 'ready', rows, retry };
}
